import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { AviationstackProvider } from "@/lib/providers/aviationstack";
import { statusFromDTO } from "@/lib/mappers";
import { iataToIana } from "@/lib/airports";
import { formatInTimeZone } from "date-fns-tz";

const prisma = getPrisma();
const flightProvider = new AviationstackProvider();

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
  const { carrierIata, flightNumber, serviceDate, originIata, destIata, notes, createdBy, schedDepLocal, schedArrLocal, schedDepLocalDate, schedArrLocalDate } = body as {
    carrierIata?: string; flightNumber: string; serviceDate: string; originIata?: string; destIata?: string; notes?: string; createdBy?: string;
    schedDepLocal?: string; schedArrLocal?: string; schedDepLocalDate?: string; schedArrLocalDate?: string;
  };

    // If carrierIata is missing, try to parse from flightNumber input like "DL295" or "SWA300"
    let derivedCarrier = carrierIata;
    let derivedNumber = flightNumber;
    if (!derivedCarrier && /^[A-Za-z]{2,3}\s*\d{1,4}$/.test((derivedNumber || '').trim())) {
      const m = derivedNumber.trim().toUpperCase().match(/^([A-Z]{2,3})\s*(\d{1,4})$/);
      if (m) {
        const alias: Record<string, string> = {
          SWA: 'WN', DAL: 'DL', UAL: 'UA', AAL: 'AA', ASA: 'AS', JBU: 'B6', NKS: 'NK', FFT: 'F9',
          BAW: 'BA', AFR: 'AF', DLH: 'LH', UAE: 'EK', SIA: 'SQ', ACA: 'AC'
        };
        const prefix = m[1];
        const mapped = alias[prefix];
        derivedCarrier = mapped || prefix.slice(0, 2);
        derivedNumber = m[2];
      }
    }

  // Validate required fields (carrierIata may be inferred later; require flightNumber + serviceDate)
  if (!derivedNumber || !serviceDate) {
      return NextResponse.json(
    { error: "flightNumber and serviceDate are required" },
        { status: 400 }
      );
    }

    // Validate carrier code format only if explicitly provided (it can be inferred)
    if (carrierIata && !/^[A-Z]{2}$/.test(carrierIata)) {
      return NextResponse.json(
        { error: "carrierIata must be a 2-letter airline code (e.g., 'DL')" },
        { status: 400 }
      );
    }

  // Validate flight number format (use derivedNumber which may come from parsing combined input)
  if (!/^\d{1,4}$/.test(derivedNumber)) {
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

    // If origin/dest or carrier are missing, try to auto-resolve from Aviationstack schedule
  let resolvedCarrier: string | undefined = carrierIata;
  let resolvedOrigin: string | undefined = originIata || undefined;
  let resolvedDest: string | undefined = destIata || undefined;
    let resolvedSchedDep: Date | undefined;
    let resolvedSchedArr: Date | undefined;
    try {
    if (!resolvedOrigin || !resolvedDest || !schedDepLocal || !schedArrLocal || !resolvedCarrier) {
        const dateStr = parsedDate.toISOString().split('T')[0];
        let sched = await flightProvider.fetchScheduleByFlight({
      airline_iata: resolvedCarrier || derivedCarrier || "",
      flight_number: derivedNumber,
          flight_date: dateStr,
        });
        if (!sched) {
      const flight_iata = `${resolvedCarrier || derivedCarrier || ""}${derivedNumber}`;
          sched = await flightProvider.fetchScheduleByIataFlight({ flight_iata, flight_date: dateStr });
        }
        if (sched) {
          resolvedCarrier = resolvedCarrier || (sched.airline?.iata || undefined);
          resolvedOrigin = resolvedOrigin || (sched.departure?.iata || undefined);
          resolvedDest = resolvedDest || (sched.arrival?.iata || undefined);
          resolvedSchedDep = sched.departure?.scheduled ? new Date(sched.departure.scheduled) : undefined;
          resolvedSchedArr = sched.arrival?.scheduled ? new Date(sched.arrival.scheduled) : undefined;
        }
      }
    } catch (e) {
      console.error('Auto-resolve schedule failed:', e);
    }

    // Use resolved values
  const carrierFinal: string | undefined = resolvedCarrier || carrierIata || undefined;
  const originFinal: string | undefined = resolvedOrigin || originIata || undefined;
  const destFinal: string | undefined = resolvedDest || destIata || undefined;

    // Check if flight already exists (upsert behavior)
  const existingFlight = await prisma.flight.findFirst({
      where: {
    carrierIata: (carrierFinal || derivedCarrier || carrierIata) as string,
    flightNumber: derivedNumber,
        serviceDate: parsedDate,
      },
    });

    let flight;
    if (existingFlight) {
      // Update existing flight
      flight = await prisma.flight.update({
        where: { id: existingFlight.id },
        data: {
          originIata: originFinal,
          destIata: destFinal,
          notes,
          createdBy,
          latestSchedDep: resolvedSchedDep ?? undefined,
          latestSchedArr: resolvedSchedArr ?? undefined,
        },
      });
    } else {
      // Create new flight
      flight = await prisma.flight.create({
        data: {
          carrierIata: (carrierFinal || derivedCarrier || carrierIata || "") as string,
          flightNumber: derivedNumber,
          serviceDate: parsedDate,
          originIata: originFinal,
          destIata: destFinal,
          notes,
          createdBy,
          latestSchedDep: resolvedSchedDep ?? undefined,
          latestSchedArr: resolvedSchedArr ?? undefined,
        },
      });
    }

    // If manual scheduled times provided (local HH:mm), convert to UTC using airport TZ offset
    if ((schedDepLocal || schedArrLocal) && (originFinal || destFinal)) {
      const depAnchorDate = schedDepLocalDate || serviceDate;
      const arrAnchorDate = schedArrLocalDate || serviceDate;
      const depAnchor = new Date(`${depAnchorDate}T00:00:00Z`);
      const arrAnchor = new Date(`${arrAnchorDate}T00:00:00Z`);
      let latestSchedDep: Date | null | undefined = undefined;
      let latestSchedArr: Date | null | undefined = undefined;

      if (schedDepLocal && originFinal) {
        const tz = iataToIana(originFinal);
        if (tz) {
          const offset = formatInTimeZone(depAnchor, tz, 'XXX');
          latestSchedDep = new Date(`${depAnchorDate}T${schedDepLocal}:00${offset}`);
        }
      }
      if (schedArrLocal && destFinal) {
        const tz = iataToIana(destFinal);
        if (tz) {
          const offset = formatInTimeZone(arrAnchor, tz, 'XXX');
          latestSchedArr = new Date(`${arrAnchorDate}T${schedArrLocal}:00${offset}`);
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
      type ProviderQuery = { carrierIata: string; flightNumber: string; serviceDateISO: string; originIata?: string; destIata?: string };
      const providerQuery: ProviderQuery = {
        carrierIata: (carrierFinal || derivedCarrier || carrierIata || "") as string,
        flightNumber: derivedNumber,
        serviceDateISO: parsedDate.toISOString().split("T")[0],
        ...(originFinal ? { originIata: originFinal } : {}),
        ...(destFinal ? { destIata: destFinal } : {}),
      };
  // The provider accepts FlightQuery; we pass an extended shape which it reads optionally.
  const statusData = await flightProvider.getStatus(providerQuery as unknown as { carrierIata: string; flightNumber: string; serviceDateISO: string });

      if (statusData) {
        const snapshot = await prisma.flightStatusSnapshot.create({
          data: {
            flightId: flight.id,
            provider: "Aviationstack",
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
