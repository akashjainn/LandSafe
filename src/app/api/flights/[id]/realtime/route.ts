import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { AeroDataProvider } from '@/lib/providers/aerodata';
import { computeTimeProgress } from '@/lib/realtime/timeProgress';
import { realtimeCache, computeTTL } from '@/lib/realtime/cache';
import { canMakeApiCall, incrementApiCall, getQuotaStatus } from '@/lib/quota';

interface ProviderStatusDTO {
  status: FlightStatusCode;
  schedDep?: string | null; schedArr?: string | null;
  estDep?: string | null; estArr?: string | null;
  actDep?: string | null; actArr?: string | null;
  originIata?: string | null; destIata?: string | null;
  // internal cached metadata
  _ttl?: number;
}
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
    const cacheKey = `rt:${flight.carrierIata}${flight.flightNumber}:${serviceDateISO}:${flight.originIata || ''}:${flight.destIata || ''}`;
  const cached = realtimeCache.get<ProviderStatusDTO>(cacheKey);

  let statusDTO: ProviderStatusDTO | undefined = cached?.data;
    let fromCache = false;
    if (cached) {
      fromCache = true;
      statusDTO = cached.data;
    }

  // Only hit provider if no cache or cache expired (we store TTL inside entry or compute on demand below)
  if (!statusDTO || (cached && cached.fetchedAt + (cached.data._ttl || 0) < Date.now())) {
      // Check quota before making API call
      if (!canMakeApiCall()) {
        console.warn('Monthly API quota exceeded, blocking external call');
        // If we have cached (even stale) data, use it; else respond with quota status immediately
        if (cached) {
          statusDTO = cached.data;
          fromCache = true;
        } else {
          return NextResponse.json({
            success: false,
            error: 'Monthly API quota exceeded',
            quota: getQuotaStatus()
          }, { status: 429 });
        }
      } else {
        try {
          const raw = await provider.getStatus({
            carrierIata: flight.carrierIata,
            flightNumber: flight.flightNumber,
            serviceDateISO,
            originIata: flight.originIata || undefined,
            destIata: flight.destIata || undefined,
          });
          statusDTO = raw ? raw as ProviderStatusDTO : undefined;
          
          // Increment quota only on successful call
          incrementApiCall();
          console.log('API call made. Quota status:', getQuotaStatus());
          
        } catch (err) {
          const statusCode = (err as { statusCode?: number })?.statusCode;
          // If rate limited (429) and we have a stale cache (even expired), reuse it
          if (statusCode === 429 && cached) {
            statusDTO = cached.data; fromCache = true;
          } else if (!cached) {
            // No data at all; proceed with empty handling below
            statusDTO = undefined;
          }
        }
      }
    }  if (!statusDTO) {
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

    // Compute dynamic TTL and cache fresh response
  if (!fromCache) {
      const depMs = statusDTO.schedDep ? new Date(statusDTO.schedDep).getTime() : undefined;
      const arrMs = statusDTO.schedArr ? new Date(statusDTO.schedArr).getTime() : undefined;
      const ttl = computeTTL({
        status: statusDTO.status,
        departed: progress.departed,
        landed: progress.landed,
        depMs,
        arrMs
      });
      // Attach ttl meta so we know when to refresh
      realtimeCache.set(cacheKey, { ...statusDTO, _ttl: ttl });
    }

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
  progress: { ...progress, cached: fromCache },
      }
    });
  } catch (e) {
    console.error('Realtime flight endpoint error', e);
    return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
  }
}
