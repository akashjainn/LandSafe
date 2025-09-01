// Upsert two flights with correct schedules/status using Prisma directly
// Run with: node scripts/upsert_flights.js

const { PrismaClient, FlightStatusCode } = require('@prisma/client');
const { formatInTimeZone } = require('date-fns-tz');

const prisma = new PrismaClient();

const IATA_TZ = {
  ATL: 'America/New_York',
  HND: 'Asia/Tokyo',
  AUS: 'America/Chicago',
};

function toUtcFromLocal(dateStr, timeStr, iata) {
  const tz = IATA_TZ[iata];
  if (!tz) throw new Error(`Unknown timezone for ${iata}`);
  const anchor = new Date(`${dateStr}T00:00:00Z`);
  const offset = formatInTimeZone(anchor, tz, 'XXX');
  return new Date(`${dateStr}T${timeStr}:00${offset}`);
}

function ensureNumStr(s) {
  // Remove leading zeros in flight number for storage consistency
  const n = String(parseInt(s, 10));
  return n;
}

async function upsertFlight({ carrierIata, flightNumber, serviceDate, originIata, destIata, depLocalDate, depLocalTime, arrLocalDate, arrLocalTime, status, notes }) {
  const serviceDateUtc = new Date(`${serviceDate}T00:00:00Z`);
  const number = ensureNumStr(flightNumber);
  const schedDep = toUtcFromLocal(depLocalDate, depLocalTime, originIata);
  const schedArr = toUtcFromLocal(arrLocalDate, arrLocalTime, destIata);

  const existing = await prisma.flight.findFirst({
    where: { carrierIata, flightNumber: number, serviceDate: serviceDateUtc },
  });

  let flight;
  if (existing) {
    flight = await prisma.flight.update({
      where: { id: existing.id },
      data: {
        originIata,
        destIata,
        notes: notes || existing.notes,
        latestSchedDep: schedDep,
        latestSchedArr: schedArr,
        latestStatus: status,
      },
    });
  } else {
    flight = await prisma.flight.create({
      data: {
        carrierIata,
        flightNumber: number,
        serviceDate: serviceDateUtc,
        originIata,
        destIata,
        notes: notes || null,
        latestSchedDep: schedDep,
        latestSchedArr: schedArr,
        latestStatus: status,
      },
    });
  }

  return flight;
}

async function main() {
  // DL0295 ATL -> HND
  await upsertFlight({
    carrierIata: 'DL',
    flightNumber: '0295',
    serviceDate: '2025-12-29',
    originIata: 'ATL',
    destIata: 'HND',
    depLocalDate: '2025-12-29',
    depLocalTime: '10:00',
    arrLocalDate: '2025-12-30',
    arrLocalTime: '14:35',
    status: 'SCHEDULED',
    notes: 'japan',
  });

  // SWA300 (Southwest is WN) ATL -> AUS on 2025-09-01
  await upsertFlight({
    carrierIata: 'WN',
    flightNumber: '300',
    serviceDate: '2025-09-01',
    originIata: 'ATL',
    destIata: 'AUS',
    depLocalDate: '2025-09-01',
    depLocalTime: '18:40',
    arrLocalDate: '2025-09-01',
    arrLocalTime: '19:55',
    status: 'SCHEDULED',
  });

  console.log('Flights upserted.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
