// Simple script to check flight data in the database
import { getPrisma } from './src/lib/db.js';

const prisma = getPrisma();

async function checkFlights() {
  try {
    console.log('Checking flights in database...\n');
    
    const flights = await prisma.flight.findMany({
      orderBy: { serviceDate: 'desc' },
    });

    if (flights.length === 0) {
      console.log('No flights found in database.');
      return;
    }

    console.log(`Found ${flights.length} flight(s):\n`);
    
    flights.forEach((flight, index) => {
      console.log(`Flight ${index + 1}:`);
      console.log(`  ID: ${flight.id}`);
      console.log(`  Flight: ${flight.carrierIata}${flight.flightNumber}`);
      console.log(`  Service Date: ${flight.serviceDate}`);
      console.log(`  Route: ${flight.originIata} → ${flight.destIata}`);
      console.log(`  Notes: ${flight.notes || 'N/A'}`);
      console.log(`  Status: ${flight.latestStatus || 'N/A'}`);
      console.log(`  Scheduled Dep: ${flight.latestSchedDep || 'N/A'}`);
      console.log(`  Scheduled Arr: ${flight.latestSchedArr || 'N/A'}`);
      console.log(`  Estimated Dep: ${flight.latestEstDep || 'N/A'}`);
      console.log(`  Estimated Arr: ${flight.latestEstArr || 'N/A'}`);
      console.log(`  Departure Gate: ${flight.latestGateDep || 'N/A'}`);
      console.log(`  Arrival Gate: ${flight.latestGateArr || 'N/A'}`);
      console.log('  ---');
    });

    // Check if there are any status snapshots
    const snapshots = await prisma.flightStatusSnapshot.findMany({
      include: { flight: true },
      orderBy: { fetchedAt: 'desc' },
      take: 5
    });

    console.log(`\nFound ${snapshots.length} status snapshots (showing last 5):`);
    snapshots.forEach((snapshot, index) => {
      console.log(`Snapshot ${index + 1}:`);
      console.log(`  Flight: ${snapshot.flight.carrierIata}${snapshot.flight.flightNumber}`);
      console.log(`  Provider: ${snapshot.provider}`);
      console.log(`  Fetched: ${snapshot.fetchedAt}`);
      console.log(`  Status: ${snapshot.status}`);
      console.log(`  Sched Dep: ${snapshot.schedDep || 'N/A'}`);
      console.log(`  Sched Arr: ${snapshot.schedArr || 'N/A'}`);
      console.log('  ---');
    });

  } catch (error) {
    console.error('Error checking flights:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkFlights();
