// src/lib/groupConnections.ts
export type Flight = {
  id: string;
  traveler?: string | null;
  airline: string;           // e.g. "DL"
  flightNumber: string;      // e.g. "1240"
  departureIata: string;     // e.g. "ATL"
  arrivalIata: string;       // e.g. "DTW"
  // Prefer *_Utc fields if you have them; otherwise local ISO strings
  scheduledDepartureUtc?: string | null;
  scheduledArrivalUtc?: string | null;
  scheduledDeparture?: string | null;
  scheduledArrival?: string | null;
  connectionGroupId?: string | null; // optional manual override
};

export type Trip = {
  key: string;
  traveler?: string | null;
  flights: Flight[];
  via: string[];
};

function toMs(iso?: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  return Number.isFinite(t) ? t : null;
}

function depMs(f: Flight): number | null {
  return toMs(f.scheduledDepartureUtc) ?? toMs(f.scheduledDeparture);
}
function arrMs(f: Flight): number | null {
  return toMs(f.scheduledArrivalUtc) ?? toMs(f.scheduledArrival);
}

function minutesBetween(aMs: number, bMs: number) {
  return (bMs - aMs) / 60000;
}

export function groupConnections(
  flights: Flight[],
  opts: { minLayoverMin?: number; maxLayoverHours?: number } = {}
): Trip[] {
  const minLayoverMin = opts.minLayoverMin ?? 20;
  const maxLayoverMin = (opts.maxLayoverHours ?? 24) * 60;

  // 1) Explicit groups by connectionGroupId
  const explicitGroups = new Map<string, Flight[]>();
  const leftovers: Flight[] = [];
  for (const f of flights) {
    if (f.connectionGroupId) {
      const k = f.connectionGroupId;
      if (!explicitGroups.has(k)) explicitGroups.set(k, []);
      explicitGroups.get(k)!.push(f);
    } else {
      leftovers.push(f);
    }
  }

  const byTraveler = new Map<string, Flight[]>();
  for (const f of leftovers) {
    const key = (f.traveler ?? "UNKNOWN").toLowerCase();
    if (!byTraveler.has(key)) byTraveler.set(key, []);
    byTraveler.get(key)!.push(f);
  }

  const trips: Trip[] = [];

  // Materialize all explicit groups as trips (sorted by time)
  for (const [, list] of explicitGroups) {
    list.sort((a, b) => (depMs(a)! - depMs(b)!));
    trips.push({
      key: `${list[0].departureIata}-${list[list.length - 1].arrivalIata}-${depMs(list[0])}`,
      traveler: list[0].traveler ?? undefined,
      flights: list,
      via: list.slice(0, -1).map(x => x.arrivalIata),
    });
  }

  // 2) Infer connections on the rest using airport chaining + layover window
  for (const [, list] of byTraveler) {
    list.sort((a, b) => (depMs(a)! - depMs(b)!));

    let current: Flight[] = [];
    for (const f of list) {
      if (current.length === 0) { current.push(f); continue; }
      const prev = current[current.length - 1];
      const prevArr = arrMs(prev);
      const nextDep = depMs(f);

      if (prevArr == null || nextDep == null) {
        trips.push({
          key: `${current[0].departureIata}-${current[current.length - 1].arrivalIata}-${depMs(current[0])}`,
          traveler: current[0].traveler ?? undefined,
          flights: current,
          via: current.slice(0, -1).map(x => x.arrivalIata),
        });
        current = [f];
        continue;
      }

      const sameAirportChain = prev.arrivalIata === f.departureIata;
      const gapMin = minutesBetween(prevArr, nextDep);
      const layoverOK = gapMin >= minLayoverMin && gapMin <= maxLayoverMin;

      if (sameAirportChain && layoverOK) {
        current.push(f);
      } else {
        trips.push({
          key: `${current[0].departureIata}-${current[current.length - 1].arrivalIata}-${depMs(current[0])}`,
          traveler: current[0].traveler ?? undefined,
          flights: current,
          via: current.slice(0, -1).map(x => x.arrivalIata),
        });
        current = [f];
      }
    }

    if (current.length) {
      trips.push({
        key: `${current[0].departureIata}-${current[current.length - 1].arrivalIata}-${depMs(current[0])}`,
        traveler: current[0].traveler ?? undefined,
        flights: current,
        via: current.slice(0, -1).map(x => x.arrivalIata),
      });
    }
  }

  return trips;
}
