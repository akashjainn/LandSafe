import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { OpenSkyProvider } from "@/lib/providers/opensky";
import { statusFromDTO } from "@/lib/mappers";
import { iataToIana } from "@/lib/airports";
import { formatInTimeZone } from "date-fns-tz";

const prisma = getPrisma();
const flightProvider = new OpenSkyProvider();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const year = searchParams.get("year");
    const month = searchParams.get("month");
    const day = searchParams.get("day");

    const whereClause: Record<string, unknown> = {};

    // If specific date provided, filter by that date
    if (date) {
      const serviceDate = new Date(date);
      if (isNaN(serviceDate.getTime())) {
        return NextResponse.json(
          { error: "Invalid date format. Use YYYY-MM-DD" },
          { status: 400 }
        );
      }
      Object.assign(whereClause, {
        serviceDate: {
          gte: serviceDate,
          lt: new Date(serviceDate.getTime() + 24 * 60 * 60 * 1000),
        }
      });
    }
    // If year/month/day filters provided, build date range
    else if (year || month || day) {
      const currentYear = new Date().getFullYear();
      const filterYear = year ? parseInt(year) : currentYear;
      const filterMonth = month ? parseInt(month) - 1 : 0; // JS months are 0-based
      const filterDay = day ? parseInt(day) : 1;

      if (year && month && day) {
        // Specific day
        const serviceDate = new Date(filterYear, filterMonth, filterDay);
        Object.assign(whereClause, {
          serviceDate: {
            gte: serviceDate,
            lt: new Date(serviceDate.getTime() + 24 * 60 * 60 * 1000),
          }
        });
      } else if (year && month) {
        // Specific month
        const startDate = new Date(filterYear, filterMonth, 1);
        const endDate = new Date(filterYear, filterMonth + 1, 1);
        Object.assign(whereClause, {
          serviceDate: {
            gte: startDate,
            lt: endDate,
          }
        });
      } else if (year) {
        // Specific year
        const startDate = new Date(filterYear, 0, 1);
        const endDate = new Date(filterYear + 1, 0, 1);
        Object.assign(whereClause, {
          serviceDate: {
            gte: startDate,
            lt: endDate,
          }
        });
      }
    }

    // Get flights with optional filtering
    const flights = await prisma.flight.findMany({
      where: whereClause,
      orderBy: [
        { serviceDate: "desc" },
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
  const { carrierIata, flightNumber, serviceDate, originIata, destIata, notes, createdBy, schedDepLocal, schedArrLocal } = body;

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

  // Parse and validate service date as UTC midnight to avoid TZ drift
  const parsedDate = new Date(`${serviceDate}T00:00:00Z`);
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

    // If manual scheduled times provided (local HH:mm), convert to UTC using airport TZ offset
    if ((schedDepLocal || schedArrLocal) && (originIata || destIata)) {
      const dayAnchor = new Date(`${serviceDate}T00:00:00Z`);
      let latestSchedDep: Date | null | undefined = undefined;
      let latestSchedArr: Date | null | undefined = undefined;

      if (schedDepLocal && originIata) {
        const tz = iataToIana(originIata);
        if (tz) {
          const offset = formatInTimeZone(dayAnchor, tz, 'XXX');
          latestSchedDep = new Date(`${serviceDate}T${schedDepLocal}:00${offset}`);
        }
      }
      if (schedArrLocal && destIata) {
        const tz = iataToIana(destIata);
        if (tz) {
          const offset = formatInTimeZone(dayAnchor, tz, 'XXX');
          latestSchedArr = new Date(`${serviceDate}T${schedArrLocal}:00${offset}`);
        }
      }
      if (latestSchedDep || latestSchedArr) {
        flight = await prisma.flight.update({
          where: { id: flight.id },
          data: {
            latestSchedDep: latestSchedDep ?? flight.latestSchedDep,
            latestSchedArr: latestSchedArr ?? flight.latestSchedArr,
          },
        });
      }
    }

    // Attempt to fetch and persist latest status so UI has times immediately
    try {
      const statusData = await flightProvider.getStatus({
        carrierIata,
        flightNumber,
        serviceDateISO: parsedDate.toISOString().split("T")[0],
      });

      if (statusData) {
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

        // Update denormalized fields
        flight = await prisma.flight.update({
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
      }
    } catch (e) {
      // Don't fail the request if provider refresh fails
      console.error("Post-create refresh failed:", e);
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
