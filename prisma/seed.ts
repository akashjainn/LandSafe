import { getPrisma } from "../src/lib/db";
import { FlightStatusCode } from "@prisma/client";

const prisma = getPrisma();

async function main() {
  // Clear existing data
  await prisma.flightStatusSnapshot.deleteMany();
  await prisma.flight.deleteMany();

  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to midnight UTC

  // Create example flights for reunion
  const flights = [
    {
      carrierIata: "DL",
      flightNumber: "123",
      serviceDate: today,
      originIata: "LAX",
      destIata: "JFK",
      notes: "Sarah's flight from LA",
      latestSchedDep: new Date(today.getTime() + 14 * 60 * 60 * 1000), // 2 PM UTC
      latestSchedArr: new Date(today.getTime() + 22 * 60 * 60 * 1000), // 10 PM UTC
      latestEstDep: new Date(today.getTime() + 14.5 * 60 * 60 * 1000), // 2:30 PM UTC (delayed)
      latestEstArr: new Date(today.getTime() + 22.5 * 60 * 60 * 1000), // 10:30 PM UTC
      latestGateDep: "A12",
      latestGateArr: "B7",
      latestStatus: FlightStatusCode.DELAYED,
    },
    {
      carrierIata: "UA",
      flightNumber: "2105",
      serviceDate: today,
      originIata: "ORD",
      destIata: "JFK",
      notes: "Mike's connecting flight",
      latestSchedDep: new Date(today.getTime() + 16 * 60 * 60 * 1000), // 4 PM UTC
      latestSchedArr: new Date(today.getTime() + 19 * 60 * 60 * 1000), // 7 PM UTC
      latestEstDep: new Date(today.getTime() + 16 * 60 * 60 * 1000), // On time
      latestEstArr: new Date(today.getTime() + 19 * 60 * 60 * 1000),
      latestGateDep: "C15",
      latestGateArr: "A3",
      latestStatus: FlightStatusCode.BOARDING,
    },
    {
      carrierIata: "AA",
      flightNumber: "276",
      serviceDate: today,
      originIata: "MIA",
      destIata: "LGA",
      notes: "Alex's flight from Miami",
      latestSchedDep: new Date(today.getTime() + 18 * 60 * 60 * 1000), // 6 PM UTC
      latestSchedArr: new Date(today.getTime() + 21 * 60 * 60 * 1000), // 9 PM UTC
      latestEstDep: new Date(today.getTime() + 18 * 60 * 60 * 1000),
      latestEstArr: new Date(today.getTime() + 21 * 60 * 60 * 1000),
      latestGateDep: "D8",
      latestGateArr: "C12",
      latestStatus: FlightStatusCode.SCHEDULED,
    },
  ];

  for (const flightData of flights) {
    const flight = await prisma.flight.create({
      data: flightData,
    });

    // Create initial status snapshot
    await prisma.flightStatusSnapshot.create({
      data: {
        flightId: flight.id,
        provider: "AeroDataBox",
        schedDep: flightData.latestSchedDep,
        schedArr: flightData.latestSchedArr,
        estDep: flightData.latestEstDep,
        estArr: flightData.latestEstArr,
        gateDep: flightData.latestGateDep,
        gateArr: flightData.latestGateArr,
        status: flightData.latestStatus,
        aircraftType: "Boeing 737",
        routeKey: `${flightData.originIata}-${flightData.destIata}`,
      },
    });

    console.log(`Created flight: ${flightData.carrierIata}${flightData.flightNumber}`);
  }

  console.log("✅ Seed data created successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
