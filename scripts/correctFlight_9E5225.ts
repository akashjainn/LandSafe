// Manual correction script for flight 9E5225 (Endeavor Air / EDV5225)
// Data provided:
// Departure: Wed 10-Sep-2025 09:37 PM EDT (Gate C36 ATL)
// Arrival (scheduled): 11:06 PM EDT, estimated 11:04 PM EDT (Gate 3 CHO) => 2 minutes early
// Current state: En route and on time (treat as ENROUTE with estArr earlier than schedArr)
// Origin: ATL, Destination: CHO

import { getPrisma } from "../src/lib/db";
import { FlightStatusCode } from "@prisma/client";

function edtToUtcIso(date: string, timeHHMM: string) {
  // EDT offset -04:00
  const iso = `${date}T${timeHHMM}:00-04:00`;
  return new Date(iso).toISOString();
}

async function main() {
  const prisma = getPrisma();
  const carrierIata = '9E';
  const flightNumber = '5225';
  const localServiceDate = '2025-09-10'; // origin-local date
  const serviceDateUtcMidnight = new Date(`${localServiceDate}T00:00:00Z`); // convention in app

  const schedDep = edtToUtcIso(localServiceDate, '21:37'); // 2025-09-11T01:37Z
  const schedArr = edtToUtcIso(localServiceDate, '23:06'); // scheduled arrival
  const estArr = edtToUtcIso(localServiceDate, '23:04');   // estimated 2 min early

  // Find existing record (might have wrong serviceDate from earlier test)
  const existingAny = await prisma.flight.findFirst({
    where: { carrierIata, flightNumber },
    orderBy: { createdAt: 'desc' }
  });

  let flightId: string;
  if (existingAny) {
    // Update to correct serviceDate & baseline fields
    const updated = await prisma.flight.update({
      where: { id: existingAny.id },
      data: {
        serviceDate: serviceDateUtcMidnight,
        originIata: 'ATL',
        destIata: 'CHO',
        latestSchedDep: new Date(schedDep),
        latestSchedArr: new Date(schedArr),
        latestEstDep: new Date(schedDep),
        latestEstArr: new Date(estArr),
        latestGateDep: 'C36',
        latestGateArr: '3',
        latestStatus: FlightStatusCode.ENROUTE,
        notes: existingAny.notes || 'Manual correction injected',
      }
    });
    flightId = updated.id;
    console.log('Updated existing flight', { id: flightId });
  } else {
    const created = await prisma.flight.create({
      data: {
        carrierIata,
        flightNumber,
        serviceDate: serviceDateUtcMidnight,
        originIata: 'ATL',
        destIata: 'CHO',
        latestSchedDep: new Date(schedDep),
        latestSchedArr: new Date(schedArr),
        latestEstDep: new Date(schedDep),
        latestEstArr: new Date(estArr),
        latestGateDep: 'C36',
        latestGateArr: '3',
        latestStatus: FlightStatusCode.ENROUTE,
        notes: 'Manual correction injected',
      }
    });
    flightId = created.id;
    console.log('Created new flight', { id: flightId });
  }

  // Insert a status snapshot to preserve this correction
  await prisma.flightStatusSnapshot.create({
    data: {
      flightId,
      provider: 'Manual',
      schedDep: new Date(schedDep),
      schedArr: new Date(schedArr),
      estDep: new Date(schedDep),
      estArr: new Date(estArr),
      gateDep: 'C36',
      gateArr: '3',
      status: FlightStatusCode.ENROUTE,
      aircraftType: 'Unknown',
      routeKey: 'ATL-CHO'
    }
  });

  console.log('Snapshot recorded for flight', flightId);
}

main().catch(e => { console.error(e); process.exit(1); });
