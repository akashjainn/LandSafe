import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { parseCarrierFlightNumber } from "@/lib/types";

const prisma = getPrisma();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { flights } = body;

    if (!Array.isArray(flights)) {
      return NextResponse.json(
        { error: "Expected 'flights' array in request body" },
        { status: 400 }
      );
    }

    const results = [];
    const errors = [];

    for (const flightData of flights) {
      try {
        const { label, carrier, number, date, originIata, destIata, notes } = flightData;

        // Parse carrier and flight number if they're combined
        let carrierIata = carrier;
        let flightNumber = number;

        if (!flightNumber && carrier) {
          const parsed = parseCarrierFlightNumber(carrier);
          if (parsed) {
            carrierIata = parsed.carrierIata;
            flightNumber = parsed.flightNumber;
          }
        }

        // Validate required fields
        if (!carrierIata || !flightNumber || !date) {
          errors.push(`Invalid flight data: missing required fields for ${JSON.stringify(flightData)}`);
          continue;
        }

        // Validate formats
        if (!/^[A-Z]{2}$/.test(carrierIata)) {
          errors.push(`Invalid carrier code '${carrierIata}' - must be 2 letters`);
          continue;
        }

        if (!/^\d{1,4}$/.test(flightNumber)) {
          errors.push(`Invalid flight number '${flightNumber}' - must be 1-4 digits`);
          continue;
        }

        // Parse service date
        const serviceDate = new Date(date);
        if (isNaN(serviceDate.getTime())) {
          errors.push(`Invalid date '${date}' - use YYYY-MM-DD format`);
          continue;
        }

        // Check if flight already exists
        const existingFlight = await prisma.flight.findFirst({
          where: {
            carrierIata,
            flightNumber,
            serviceDate,
          },
        });

        let flight;
        if (existingFlight) {
          // Update existing flight
          flight = await prisma.flight.update({
            where: { id: existingFlight.id },
            data: {
              originIata,
              destIata,
              notes: label || notes,
            },
          });
        } else {
          // Create new flight
          flight = await prisma.flight.create({
            data: {
              carrierIata,
              flightNumber,
              serviceDate,
              originIata,
              destIata,
              notes: label || notes,
            },
          });
        }

        results.push(flight);
      } catch (flightError) {
        console.error(`Error processing flight:`, flightError);
        errors.push(`Failed to process flight: ${JSON.stringify(flightData)}`);
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        created: results.length,
        flights: results,
        errors,
      },
    });
  } catch (error) {
    console.error("Error in batch flight creation:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
