import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { parseCarrierFlightNumber } from "@/lib/types";
import { AeroDataProvider } from "@/lib/providers/aerodata";
import { statusFromDTO } from "@/lib/mappers";
// removed unused FlightStatusCode import
import { normalizeAirlineCode } from "@/lib/airlineCodes";
import { normalizeFlight } from "@/lib/flightNormalize";
import { iataToIana } from "@/lib/airports";
import { formatInTimeZone } from "date-fns-tz";

const prisma = getPrisma();
const flightProvider = new AeroDataProvider();

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
        const { label, carrier, number, date, originIata, destIata, notes, flight: combined } = flightData;

        // Derive carrier/number from inputs: prefer explicit, else combined (e.g., DL295)
        let derivedCarrier: string | undefined = carrier;
        let derivedNumber: string | undefined = number;

        const inputCombined = combined || (!number && carrier ? carrier : undefined);
        if ((!derivedNumber || !derivedCarrier) && inputCombined) {
          // Prefer broad normalizer (callsigns, ICAO, IATA, spaces/dashes)
          const broad = normalizeFlight(inputCombined);
          const parsed = broad || parseCarrierFlightNumber(inputCombined);
          if (parsed) {
            derivedCarrier = parsed.carrierIata;
            derivedNumber = parsed.flightNumber;
          } else {
            // Try regex parse (including 3-letter ICAO -> normalize to IATA)
            const trimmed = inputCombined.trim().toUpperCase();
            const m = trimmed.match(/^([A-Z]{2,3})\s*(\d{1,4})$/);
            if (m) {
              const prefix = m[1];
              derivedCarrier = normalizeAirlineCode(prefix);
              derivedNumber = m[2];
            }
          }
        }

        // Ensure any derived/provided carrier is normalized to IATA (handles ICAO like UAE->EK)
        if (derivedCarrier) {
          derivedCarrier = normalizeAirlineCode(derivedCarrier);
        }

        // Validate minimal required fields
        if (!date) {
          errors.push(`Missing date for ${JSON.stringify(flightData)}`);
          continue;
        }
        if (!derivedNumber) {
          errors.push(`Missing or invalid flight number for ${JSON.stringify(flightData)}`);
          continue;
        }
        if (!/^\d{1,4}$/.test(derivedNumber)) {
          errors.push(`Invalid flight number '${derivedNumber}' - must be 1-4 digits`);
          continue;
        }

        // Parse service date at UTC midnight
        const serviceDate = new Date(`${date}T00:00:00Z`);
        if (isNaN(serviceDate.getTime())) {
          errors.push(`Invalid date '${date}' - use YYYY-MM-DD format`);
          continue;
        }

  // Auto-resolve scheduled/origin/dest will be handled by provider status fetch below
  const resolvedCarrier = derivedCarrier;
  const resolvedOrigin: string | undefined = originIata;
  const resolvedDest: string | undefined = destIata;
  // (Removed Aviationstack schedule pre-fetch)

        // We must have a carrier at this point to upsert
  if (!resolvedCarrier) {
          errors.push(`Unable to resolve carrier for flight ${combined || `${carrier}${number}`}`);
          continue;
        }

        // Upsert flight
  const existingFlight = await prisma.flight.findFirst({
          where: {
            carrierIata: resolvedCarrier,
            flightNumber: derivedNumber,
            serviceDate,
          },
        });

        let flight;
        if (existingFlight) {
          flight = await prisma.flight.update({
            where: { id: existingFlight.id },
            data: {
              originIata: resolvedOrigin,
              destIata: resolvedDest,
              // Sched times will be populated from provider snapshot if returned
              notes: label || notes,
              // createdBy removed (global scope)
            },
          });
        } else {
          flight = await prisma.flight.create({
            data: {
              carrierIata: resolvedCarrier,
              flightNumber: derivedNumber,
              serviceDate,
              originIata: resolvedOrigin,
              destIata: resolvedDest,
              // Sched times will be populated from provider snapshot if returned
              notes: label || notes,
              // createdBy removed (global scope)
            },
          });
        }

        // Fetch and persist latest status
        try {
          const statusData = await flightProvider.getStatus({
            carrierIata: normalizeAirlineCode(resolvedCarrier),
            flightNumber: derivedNumber,
            serviceDateISO: serviceDate.toISOString().split('T')[0],
            originIata: resolvedOrigin,
            destIata: resolvedDest,
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

            // Correct serviceDate to origin-local day when provider indicates different local date
            let correctedServiceDate: Date | undefined;
            try {
              const originForTz = statusData.originIata || resolvedOrigin || flight.originIata || undefined;
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
              originIata: statusData.originIata || flight.originIata,
              destIata: statusData.destIata || flight.destIata,
            };
            const finalData = (() => {
              if (correctedServiceDate) {
                const currentIso = flight.serviceDate.toISOString().split('T')[0];
                const correctedIso = correctedServiceDate.toISOString().split('T')[0];
                if (currentIso !== correctedIso) {
                  return { ...updateData, serviceDate: correctedServiceDate };
                }
              }
              return updateData;
            })();

            await prisma.flight.update({ where: { id: flight.id }, data: finalData });
          }
        } catch (refreshErr) {
          console.error('Batch post-create refresh failed:', refreshErr);
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
