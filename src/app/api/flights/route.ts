import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";

const prisma = getPrisma();

export async function GET(request: NextRequest) {
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
      orderBy: [
        { latestEstDep: "asc" },
        { latestSchedDep: "asc" },
        { carrierIata: "asc" },
        { flightNumber: "asc" },
      ],
    });

    return NextResponse.json({
      success: true,
      data: flights,
    });
  } catch (error) {
    console.error("Error fetching flights:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { carrierIata, flightNumber, serviceDate, originIata, destIata, notes, createdBy } = body;

    // Validate required fields
    if (!carrierIata || !flightNumber || !serviceDate) {
      return NextResponse.json(
        { error: "carrierIata, flightNumber, and serviceDate are required" },
        { status: 400 }
      );
    }

    // Validate carrier code format
    if (!/^[A-Z]{2}$/.test(carrierIata)) {
      return NextResponse.json(
        { error: "carrierIata must be a 2-letter airline code (e.g., 'DL')" },
        { status: 400 }
      );
    }

    // Validate flight number format
    if (!/^\d{1,4}$/.test(flightNumber)) {
      return NextResponse.json(
        { error: "flightNumber must be 1-4 digits" },
        { status: 400 }
      );
    }

    // Parse and validate service date
    const parsedDate = new Date(serviceDate);
    if (isNaN(parsedDate.getTime())) {
      return NextResponse.json(
        { error: "Invalid serviceDate format. Use YYYY-MM-DD" },
        { status: 400 }
      );
    }

    // Check if flight already exists (upsert behavior)
    const existingFlight = await prisma.flight.findFirst({
      where: {
        carrierIata,
        flightNumber,
        serviceDate: parsedDate,
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
          notes,
          createdBy,
        },
      });
    } else {
      // Create new flight
      flight = await prisma.flight.create({
        data: {
          carrierIata,
          flightNumber,
          serviceDate: parsedDate,
          originIata,
          destIata,
          notes,
          createdBy,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: flight,
    });
  } catch (error) {
    console.error("Error creating/updating flight:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
