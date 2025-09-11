// Utility to compute a normalized flight progress percent (0-100).
// Handles missing actual times and falls back to schedule interpolation.
export function percentProgress(opts: {
  scheduledDeparture?: string | Date | null;
  estimatedArrival?: string | Date | null;
  actualDeparture?: string | Date | null;
  actualArrival?: string | Date | null;
  status?: string | null;
  now?: Date;
}): number {
  const {
    scheduledDeparture,
    estimatedArrival,
    actualDeparture,
    actualArrival,
    status,
    now = new Date(),
  } = opts;

  const norm = (v?: string | Date | null) => {
    if (!v) return undefined;
    try { return new Date(v).getTime(); } catch { return undefined; }
  };

  const s = (status || '').toLowerCase();
  const tActArr = norm(actualArrival);
  if (tActArr) return 100; // Landed / arrived
  if (/landed|arrived/.test(s)) return 100;

  const tActDep = norm(actualDeparture);
  if (!tActDep && /scheduled|boarding|delayed/.test(s)) return 0;

  // If departed but not yet arrived, interpolate using actual dep -> est(arr)/sched(arr)
  if (tActDep && /departed|airborne|en ?route|en-route|enroute/.test(s)) {
    const tArr = norm(estimatedArrival) ?? norm(scheduledDeparture) ?? norm(estimatedArrival);
    if (tArr && tArr > tActDep) {
      const p = ((now.getTime() - tActDep) / (tArr - tActDep)) * 100;
      return clamp(Math.round(p), 1, 99);
    }
  }

  // Fallback: schedule window interpolation (pre-departure will yield 0 until start passes)
  const tSchedDep = norm(scheduledDeparture) ?? tActDep;
  const tEstArr = norm(estimatedArrival);
  
  if (tSchedDep && tEstArr && tEstArr > tSchedDep) {
    if (now.getTime() <= tSchedDep) return 0;
    if (now.getTime() >= tEstArr) return 100;
    const p = ((now.getTime() - tSchedDep) / (tEstArr - tSchedDep)) * 100;
    return clamp(Math.round(p), 0, 100);
  }
  
  return 0;
}

function clamp(n: number, a: number, b: number) { return Math.min(b, Math.max(a, n)); }
