// Manual connection utility for debugging grouping issues
import { getPrisma } from "@/lib/db";

const prisma = getPrisma();

export async function linkFlights(flightIds: string[], connectionGroupId: string) {
  try {
    await prisma.flight.updateMany({
      where: {
        id: {
          in: flightIds
        }
      },
      data: {
        // Note: This assumes you've added connectionGroupId to your Prisma schema
        // If not, you can store it in the notes field temporarily
        notes: connectionGroupId
      }
    });
    
    console.log(`Linked flights ${flightIds.join(', ')} with group ID: ${connectionGroupId}`);
    return { success: true };
  } catch (error) {
    console.error('Failed to link flights:', error);
    return { success: false, error };
  }
}

// Manual linking for your specific case
export async function linkDL1240AndDL275() {
  try {
    // Find the flights by carrier, flight number, and date
    const dl1240 = await prisma.flight.findFirst({
      where: {
        carrierIata: 'DL',
        flightNumber: '1240',
        serviceDate: {
          gte: new Date('2025-12-30T00:00:00Z'),
          lt: new Date('2025-12-31T00:00:00Z')
        }
      }
    });
    
    const dl275 = await prisma.flight.findFirst({
      where: {
        carrierIata: 'DL',
        flightNumber: '275',
        serviceDate: {
          gte: new Date('2025-12-30T00:00:00Z'),
          lt: new Date('2025-12-31T00:00:00Z')
        }
      }
    });
    
    if (!dl1240 || !dl275) {
      console.log('One or both flights not found:', { dl1240: !!dl1240, dl275: !!dl275 });
      return { success: false, error: 'Flights not found' };
    }
    
    const groupId = 'AKASH-2025-12-30-ATL-HND';
    await linkFlights([dl1240.id, dl275.id], groupId);
    
    return { success: true, flights: [dl1240, dl275] };
  } catch (error) {
    console.error('Failed to link DL flights:', error);
    return { success: false, error };
  }
}
