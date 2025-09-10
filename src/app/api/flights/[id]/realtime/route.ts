import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { AeroDataProvider } from '@/lib/providers/aerodata';
import { computeTimeProgress } from '@/lib/realtime/timeProgress';
import { FlightStatusCode } from '@/lib/types';

const prisma = getPrisma();
const provider = new AeroDataProvider();

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const flight = await prisma.flight.findUnique({ where: { id } });
    if (!flight) return NextResponse.json({ success: false, error: 'Not found' }, { status: 404 });

    // Build provider query (serviceDate stored as UTC midnight of local date)
    const serviceDateISO = flight.serviceDate.toISOString().split('T')[0];
    const statusDTO = await provider.getStatus({
      carrierIata: flight.carrierIata,
      flightNumber: flight.flightNumber,
      serviceDateISO,
      originIata: flight.originIata || undefined,
      destIata: flight.destIata || undefined,
    });

    if (!statusDTO) {
      return NextResponse.json({
        success: true,
        data: {
          flightId: flight.id,
          carrierIata: flight.carrierIata,
          flightNumber: flight.flightNumber,
          progress: { percent: 0, basis: 'time' as const, departed: false, landed: false },
        }
      });
    }

    const progress = computeTimeProgress({
      schedDep: statusDTO.schedDep,
      schedArr: statusDTO.schedArr,
      estDep: statusDTO.estDep,
      estArr: statusDTO.estArr,
      actDep: statusDTO.actDep,
      actArr: statusDTO.actArr,
    });

    // Derive a normalized status emphasizing DEPARTED / LANDED based on actual times
    let status = statusDTO.status;
    if (progress.landed) status = FlightStatusCode.LANDED;
    else if (progress.departed && (status === FlightStatusCode.SCHEDULED || status === FlightStatusCode.BOARDING)) status = FlightStatusCode.DEPARTED;
    else if (progress.departed && !progress.landed) status = FlightStatusCode.ENROUTE;

    return NextResponse.json({
      success: true,
      data: {
        flightId: flight.id,
        carrierIata: flight.carrierIata,
        flightNumber: flight.flightNumber,
        originIata: statusDTO.originIata || flight.originIata,
        destIata: statusDTO.destIata || flight.destIata,
        status,
        times: {
          schedDep: statusDTO.schedDep,
            schedArr: statusDTO.schedArr,
            estDep: statusDTO.estDep,
            estArr: statusDTO.estArr,
            actDep: statusDTO.actDep,
            actArr: statusDTO.actArr,
        },
        progress,
      }
    });
  } catch (e) {
    console.error('Realtime flight endpoint error', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
