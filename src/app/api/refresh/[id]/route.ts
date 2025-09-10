import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { AeroDataProvider } from "@/lib/providers/aerodata";
import { statusFromDTO } from "@/lib/mappers";
import { iataToIana } from "@/lib/airports";
import { formatInTimeZone } from "date-fns-tz";

const prisma = getPrisma();
const flightProvider = new AeroDataProvider();

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

  // Get the flight (global)
  const flight = await prisma.flight.findUnique({ where: { id } });

    if (!flight) {
      return NextResponse.json(
        { error: "Flight not found" },
        { status: 404 }
      );
    }

    // Query the flight provider
    const flightQuery = {
      carrierIata: flight.carrierIata,
      flightNumber: flight.flightNumber,
      serviceDateISO: flight.serviceDate.toISOString().split('T')[0], // YYYY-MM-DD
      ...(flight.originIata ? { originIata: flight.originIata } : {}),
      ...(flight.destIata ? { destIata: flight.destIata } : {}),
    } as const;

    const statusData = await flightProvider.getStatus(flightQuery);

    if (!statusData) {
      return NextResponse.json(
        { error: "Unable to fetch flight status" },
        { status: 503 }
      );
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

    // Determine origin-local service date from provider data; if differs, correct the record
    let correctedServiceDate: Date | undefined;
    try {
      const originForTz = statusData.originIata || flight.originIata || undefined;
      const baseTime = snapshot.schedDep || snapshot.estDep || snapshot.actDep;
      if (originForTz && baseTime) {
        const tz = iataToIana(originForTz);
        if (tz) {
          const localIso = formatInTimeZone(baseTime, tz, 'yyyy-MM-dd');
          correctedServiceDate = new Date(`${localIso}T00:00:00Z`);
        }
      }
    } catch {}

    // Update denormalized fields on flight record
    const baseUpdate = {
      latestSchedDep: snapshot.schedDep,
      latestSchedArr: snapshot.schedArr,
      latestEstDep: snapshot.estDep,
      latestEstArr: snapshot.estArr,
      latestGateDep: snapshot.gateDep,
      latestGateArr: snapshot.gateArr,
      latestTerminalDep: snapshot.terminalDep,
      latestTerminalArr: snapshot.terminalArr,
      latestStatus: snapshot.status,
      originIata: statusData.originIata || flight.originIata,
      destIata: statusData.destIata || flight.destIata,
    } as const;

    const withDate = (() => {
      if (correctedServiceDate) {
        const currentIso = flight.serviceDate.toISOString().split('T')[0];
        const correctedIso = correctedServiceDate.toISOString().split('T')[0];
        if (currentIso !== correctedIso) {
          return { ...baseUpdate, serviceDate: correctedServiceDate };
        }
      }
      return baseUpdate;
    })();

    const updatedFlight = await prisma.flight.update({
      where: { id: flight.id },
      data: withDate,
    });

    return NextResponse.json({
      success: true,
      data: {
        flight: updatedFlight,
        snapshot,
      },
    });
  } catch (error) {
    console.error("Error refreshing flight:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
