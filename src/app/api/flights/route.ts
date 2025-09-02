import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { AeroDataProvider } from "@/lib/providers/aerodata";
import { statusFromDTO } from "@/lib/mappers";
import { iataToIana } from "@/lib/airports";
import { normalizeAirlineCode } from "@/lib/airlineCodes";
import { normalizeFlight } from "@/lib/flightNormalize";
import { formatInTimeZone } from "date-fns-tz";
import type { Prisma } from "@prisma/client";

const prisma = getPrisma();
const flightProvider = new AeroDataProvider();

export async function GET(request: NextRequest) {
  try {
  // Per-user scoping via uid cookie
  const existingUid = request.cookies.get("uid")?.value;
  const uid = existingUid || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2));
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

    // Always filter by current user
    Object.assign(whereClause, { createdBy: uid });

    // Get flights with optional filtering for this user
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

    const res = NextResponse.json({
      success: true,
      data: flights,
    });
    if (!existingUid) {
      res.cookies.set("uid", uid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
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
  // Per-user scoping via uid cookie
  const existingUid = request.cookies.get("uid")?.value;
  const uid = existingUid || (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : Math.random().toString(36).slice(2));
  const body = await request.json();
  const { carrierIata, flightNumber, serviceDate, originIata, destIata, notes, createdBy, schedDepLocal, schedArrLocal, schedDepLocalDate, schedArrLocalDate } = body as {
    carrierIata?: string; flightNumber: string; serviceDate: string; originIata?: string; destIata?: string; notes?: string; createdBy?: string;
    schedDepLocal?: string; schedArrLocal?: string; schedDepLocalDate?: string; schedArrLocalDate?: string;
  };

    // If carrierIata is missing, try to parse from freeform input like "DL295", "SWA 300", "UAE0313", "Speedbird 287"
    let derivedCarrier = carrierIata;
    let derivedNumber = flightNumber;
    if (!derivedCarrier) {
      const norm = normalizeFlight(derivedNumber || "");
      if (norm) {
        derivedCarrier = norm.carrierIata;
        derivedNumber = norm.flightNumber;
      } else if (/^[A-Za-z]{2,3}\s*\d{1,4}$/.test((derivedNumber || '').trim())) {
        const m = (derivedNumber || '').trim().toUpperCase().match(/^([A-Z]{2,3})\s*(\d{1,4})$/);
        if (m) {
          derivedCarrier = normalizeAirlineCode(m[1]);
          derivedNumber = m[2];
        }
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

    // Use available values; we'll enrich from AeroDataBox after creation
  const carrierFinal: string | undefined = carrierIata || derivedCarrier || undefined;
  const originFinal: string | undefined = originIata || undefined;
  const destFinal: string | undefined = destIata || undefined;

    // Check if flight already exists (upsert behavior)
  const existingFlight = await prisma.flight.findFirst({
      where: {
    carrierIata: (carrierFinal || derivedCarrier || carrierIata) as string,
    flightNumber: derivedNumber,
    serviceDate: parsedDate,
    createdBy: uid,
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
          createdBy: uid,
          // Sched times will be filled from provider below if available
        },
      });
    } else {
      // Create new flight
      flight = await prisma.flight.create({
        data: {
          carrierIata: (carrierFinal || derivedCarrier || "") as string,
          flightNumber: derivedNumber,
          serviceDate: parsedDate,
          originIata: originFinal,
          destIata: destFinal,
          notes,
          createdBy: uid,
          // Sched times will be filled from provider below if available
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
        carrierIata: normalizeAirlineCode((carrierFinal || derivedCarrier || carrierIata || "") as string),
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
        // Determine origin-local service date from provider data; if differs, correct the record
        const originForTz = statusData.originIata || originFinal || flight.originIata || undefined;
        let correctedServiceDate: Date | undefined;
        try {
          const baseTime = snapshot.schedDep || snapshot.estDep || snapshot.actDep;
          if (originForTz && baseTime) {
            const tz = iataToIana(originForTz);
            if (tz) {
              const localIso = formatInTimeZone(baseTime, tz, 'yyyy-MM-dd');
              correctedServiceDate = new Date(`${localIso}T00:00:00Z`);
            }
          }
        } catch {}

  const updateData = {
          latestSchedDep: snapshot.schedDep,
          latestSchedArr: snapshot.schedArr,
          latestEstDep: snapshot.estDep,
          latestEstArr: snapshot.estArr,
          latestGateDep: snapshot.gateDep,
          latestGateArr: snapshot.gateArr,
          latestTerminalDep: snapshot.terminalDep,
          latestTerminalArr: snapshot.terminalArr,
          latestStatus: snapshot.status,
          originIata: statusData.originIata || flight.originIata || undefined,
          destIata: statusData.destIata || flight.destIata || undefined,
        };
        const finalUpdate: Prisma.FlightUpdateInput = (() => {
          if (correctedServiceDate) {
            const currentIso = flight.serviceDate.toISOString().split('T')[0];
            const correctedIso = correctedServiceDate.toISOString().split('T')[0];
            if (currentIso !== correctedIso) {
              return { ...updateData, serviceDate: correctedServiceDate } as Prisma.FlightUpdateInput;
            }
          }
          return updateData as Prisma.FlightUpdateInput;
        })();

        flight = await prisma.flight.update({ where: { id: flight.id }, data: finalUpdate });
      }
    } catch (e) {
      // Don't fail the request if provider refresh fails
      console.error("Post-create refresh failed:", e);
    }

    const res = NextResponse.json({
      success: true,
      data: flight,
    });
    if (!existingUid) {
      res.cookies.set("uid", uid, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
    }
    return res;
  } catch (error) {
    console.error("Error creating/updating flight:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
