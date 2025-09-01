import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { parseCarrierFlightNumber } from "@/lib/types";
import { AviationstackProvider } from "@/lib/providers/aviationstack";
import { statusFromDTO } from "@/lib/mappers";

const prisma = getPrisma();
const flightProvider = new AviationstackProvider();

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
          const parsed = parseCarrierFlightNumber(inputCombined);
          if (parsed) {
            derivedCarrier = parsed.carrierIata;
            derivedNumber = parsed.flightNumber;
          } else {
            // Try regex parse (including 3-letter aliases)
            const trimmed = inputCombined.trim().toUpperCase();
            const m = trimmed.match(/^([A-Z]{2,3})\s*(\d{1,4})$/);
            if (m) {
              const alias: Record<string, string> = {
                SWA: 'WN', DAL: 'DL', UAL: 'UA', AAL: 'AA', ASA: 'AS', JBU: 'B6', NKS: 'NK', FFT: 'F9',
                BAW: 'BA', AFR: 'AF', DLH: 'LH', UAE: 'EK', SIA: 'SQ', ACA: 'AC'
              };
              const prefix = m[1];
              derivedCarrier = alias[prefix] || prefix.slice(0, 2);
              derivedNumber = m[2];
            }
          }
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

        // Auto-resolve missing carrier/origin/dest and scheduled times using Aviationstack
        let resolvedCarrier = derivedCarrier;
        let resolvedOrigin: string | undefined = originIata;
        let resolvedDest: string | undefined = destIata;
        let resolvedSchedDep: Date | undefined;
        let resolvedSchedArr: Date | undefined;
        try {
          if (!resolvedOrigin || !resolvedDest || !resolvedCarrier) {
            const dateStr = serviceDate.toISOString().split('T')[0];
            let sched = resolvedCarrier
              ? await flightProvider.fetchScheduleByFlight({ airline_iata: resolvedCarrier, flight_number: derivedNumber, flight_date: dateStr })
              : null;
            if (!sched) {
              const flight_iata = `${resolvedCarrier || ''}${derivedNumber}`;
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
          console.error('Batch auto-resolve schedule failed:', e);
        }

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
              latestSchedDep: resolvedSchedDep ?? undefined,
              latestSchedArr: resolvedSchedArr ?? undefined,
              notes: label || notes,
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
              latestSchedDep: resolvedSchedDep ?? undefined,
              latestSchedArr: resolvedSchedArr ?? undefined,
              notes: label || notes,
            },
          });
        }

        // Fetch and persist latest status
        try {
          const statusData = await flightProvider.getStatus({
            carrierIata: resolvedCarrier,
            flightNumber: derivedNumber,
            serviceDateISO: serviceDate.toISOString().split('T')[0],
          });

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
