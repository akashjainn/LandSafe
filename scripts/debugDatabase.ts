// Debug script to check what flights exist in the database and their data
import { getPrisma } from "../src/lib/db";

async function main() {
  const prisma = getPrisma();
  
  const flights = await prisma.flight.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      statuses: {
        orderBy: { fetchedAt: 'desc' },
        take: 1
      }
    }
  });
  
  console.log(`Found ${flights.length} flights in database:`);
  
  for (const flight of flights) {
    console.log('\n---');
    console.log(`ID: ${flight.id}`);
    console.log(`Flight: ${flight.carrierIata}${flight.flightNumber}`);
    console.log(`Service Date: ${flight.serviceDate.toISOString().slice(0, 10)}`);
    console.log(`Origin: ${flight.originIata} -> Dest: ${flight.destIata}`);
    console.log(`Latest Status: ${flight.latestStatus}`);
    console.log(`Latest Sched Dep: ${flight.latestSchedDep?.toISOString()}`);
    console.log(`Latest Sched Arr: ${flight.latestSchedArr?.toISOString()}`);
    console.log(`Notes: ${flight.notes}`);
    console.log(`Created: ${flight.createdAt.toISOString()}`);
    
    if (flight.statuses.length > 0) {
      const latest = flight.statuses[0];
      console.log(`Latest Snapshot: ${latest.provider} at ${latest.fetchedAt.toISOString()}`);
      console.log(`  Status: ${latest.status}`);
      console.log(`  Sched Dep: ${latest.schedDep?.toISOString()}`);
      console.log(`  Act Dep: ${latest.actDep?.toISOString()}`);
    }
  }
  
  if (flights.length === 0) {
    console.log('\nNo flights found. You may need to:');
    console.log('1. Run: npm run db:seed');
    console.log('2. Or manually add flights via the upload page');
  }
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
