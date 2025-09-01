import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { AeroDataProvider } from "@/lib/providers/aerodata";
import { statusFromDTO } from "@/lib/mappers";
import { BulkRefreshResult } from "@/lib/types";
import pLimit from "p-limit";

const prisma = getPrisma();
const flightProvider = new AeroDataProvider();
const limit = pLimit(5); // Cap concurrency at 5 requests

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "Date parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    // Parse date and create date range for the day
    const serviceDate = new Date(date);
    if (isNaN(serviceDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Get all flights for the specified date
    const flights = await prisma.flight.findMany({
      where: {
        serviceDate: {
          gte: serviceDate,
          lt: new Date(serviceDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    if (flights.length === 0) {
      return NextResponse.json({
        success: true,
        data: { updated: 0, errors: [] },
      });
    }

    const errors: string[] = [];
    let updated = 0;

    // Process flights with concurrency limit
    const refreshPromises = flights.map((flight: typeof flights[number]) =>
      limit(async () => {
        try {
          const flightQuery = {
            carrierIata: flight.carrierIata,
            flightNumber: flight.flightNumber,
            serviceDateISO: flight.serviceDate.toISOString().split('T')[0],
          };

          const statusData = await flightProvider.getStatus(flightQuery);

          if (!statusData) {
            errors.push(`Unable to fetch status for ${flight.carrierIata}${flight.flightNumber}`);
            return;
          }

          // Create status snapshot
          const snapshot = await prisma.flightStatusSnapshot.create({
            data: {
              flightId: flight.id,
              provider: "AeroDataBox",
              schedDep: statusData.schedDep ? new Date(statusData.schedDep) : null,
              schedArr: statusData.schedArr ? new Date(statusData.schedArr) : null,
              estDep: statusData.estDep ? new Date(statusData.estDep) : null,
              estArr: statusData.estArr ? new Date(statusData.estArr) : null,
              actDep: statusData.actDep ? new Date(statusData.actDep) : null,
              actArr: statusData.actArr ? new Date(statusData.actArr) : null,
              gateDep: statusData.gateDep,
              gateArr: statusData.gateArr,
              terminalDep: statusData.terminalDep,
              terminalArr: statusData.terminalArr,
              status: statusFromDTO(statusData),
              delayReason: statusData.delayReason,
              aircraftType: statusData.aircraftType,
              routeKey: statusData.originIata && statusData.destIata 
                ? `${statusData.originIata}-${statusData.destIata}` 
                : null,
            },
          });

          // Update denormalized fields on flight record
          await prisma.flight.update({
            where: { id: flight.id },
            data: {
              latestSchedDep: snapshot.schedDep,
              latestSchedArr: snapshot.schedArr,
              latestEstDep: snapshot.estDep,
              latestEstArr: snapshot.estArr,
              latestGateDep: snapshot.gateDep,
              latestGateArr: snapshot.gateArr,
              latestStatus: snapshot.status,
              originIata: statusData.originIata || flight.originIata,
              destIata: statusData.destIata || flight.destIata,
            },
          });

          updated++;
        } catch (error) {
          console.error(`Error refreshing flight ${flight.carrierIata}${flight.flightNumber}:`, error);
          errors.push(`Failed to refresh ${flight.carrierIata}${flight.flightNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      })
    );

    // Wait for all refresh operations to complete
    await Promise.all(refreshPromises);

    const result: BulkRefreshResult = {
      updated,
      errors,
    };

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error("Error in bulk refresh:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
