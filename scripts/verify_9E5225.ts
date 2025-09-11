// Verification script: compare current realtime provider response for 9E5225 (service date 2025-09-10)
// against expected snapshot provided by user.
import { getPrisma } from "../src/lib/db";
import { NextRequest } from "next/server";
import { GET as realtimeGet } from "../src/app/api/flights/[id]/realtime/route";
import { FlightStatusCode } from "@prisma/client";
import { normalizeAirlineCode } from "../src/lib/airlineCodes";

const EXPECTED = {
  originIata: 'ATL',
  destIata: 'CHO',
  status: 'ENROUTE',
  schedDepLocalEDT: '2025-09-10 21:37',
  schedArrLocalEDT: '2025-09-10 23:06',
  estArrLocalEDT: '2025-09-10 23:04',
  // Converted to UTC:
  schedDepUtc: '2025-09-11T01:37:00Z',
  schedArrUtc: '2025-09-11T03:06:00Z',
  estArrUtc: '2025-09-11T03:04:00Z'
};

async function ensureFlight() {
  const prisma = getPrisma();
  const carrierIata = normalizeAirlineCode('EDV'); // -> 9E
  const flightNumber = '5225';
  const serviceDate = new Date('2025-09-10T00:00:00Z');
  let flight = await prisma.flight.findFirst({ where: { carrierIata, flightNumber, serviceDate } });
  if (!flight) {
    flight = await prisma.flight.create({
      data: {
        carrierIata,
        flightNumber,
        serviceDate,
        originIata: EXPECTED.originIata,
        destIata: EXPECTED.destIata,
        latestSchedDep: new Date(EXPECTED.schedDepUtc),
        latestSchedArr: new Date(EXPECTED.schedArrUtc),
        latestEstDep: new Date(EXPECTED.schedDepUtc),
        latestEstArr: new Date(EXPECTED.estArrUtc),
        latestStatus: FlightStatusCode.ENROUTE,
        notes: 'Verification baseline'
      }
    });
  }
  return flight;
}

function diff(expected: any, actual: any) {
  const out: Record<string, { expected: any; actual: any }> = {};
  for (const [k, v] of Object.entries(expected)) {
    const a = (actual as any)[k];
    if (a !== v) out[k] = { expected: v, actual: a };
  }
  return out;
}

async function main() {
  const flight = await ensureFlight();
  const res = await realtimeGet(new NextRequest('http://local.test/realtime'), { params: Promise.resolve({ id: flight.id }) });
  const json = await (res as Response).json();
  const rt = json?.data;
  if (!rt) {
    console.error('No realtime data returned');
    process.exit(1);
  }
  const comparison = {
    originIata: rt.originIata,
    destIata: rt.destIata,
    status: rt.status,
    schedDepUtc: rt.times?.schedDep,
    schedArrUtc: rt.times?.schedArr,
    estArrUtc: rt.times?.estArr
  };
  const differences = diff(EXPECTED, comparison);
  console.log('Realtime raw:', JSON.stringify(rt, null, 2));
  if (Object.keys(differences).length) {
    console.log('Differences vs expected:', differences);
  } else {
    console.log('All expected fields match.');
  }
}

main().catch(e => { console.error(e); process.exit(1); });
