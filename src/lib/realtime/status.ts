// status.ts - Derive canonical flight status with heuristics.
import { Flight, FlightStatus, ProgressMeta, Position, Airport } from "./geo";
import { haversineNm, isStale } from "./geo";

interface DeriveOptions {
  approachRadiusNm?: number;
  arrivalGroundRadiusNm?: number;
}

const DEFAULTS: Required<DeriveOptions> = {
  approachRadiusNm: 25,
  arrivalGroundRadiusNm: 3,
};

export function deriveStatus(flight: Flight, progress?: ProgressMeta, opts: DeriveOptions = {}): FlightStatus {
  const { approachRadiusNm, arrivalGroundRadiusNm } = { ...DEFAULTS, ...opts };
  const p = flight.current;
  const origin = flight.origin;
  const dest = flight.diverted_to || flight.destination;
  const statusCode = flight.status_code;

  const atd = flight.actuals?.atd || flight.actuals?.off_block_time;
  const ata = flight.actuals?.ata || flight.actuals?.on_block_time;
  const std = flight.schedule?.std;

  // Primary explicit signals
  if (statusCode === "CANCELLED") return "CANCELLED";
  if (statusCode === "DIVERTED") return "DIVERTED";

  // Landed heuristics
  if (ata) return "LANDED";
  if (p && near(p, dest, arrivalGroundRadiusNm) && landedHeuristic(p)) return "LANDED";
  if (statusCode === "LANDED") return "LANDED";

  // Diverted if destination changed mid-flight (presence of diverted_to)
  if (flight.diverted_to) {
    // If we have arrived at diverted dest
    if (p && near(p, dest, arrivalGroundRadiusNm) && landedHeuristic(p)) return "LANDED";
    return "DIVERTED";
  }

  // Departed heuristics
  if (atd) {
    if (!p) return "DEPARTED"; // no position yet
  }
  if (p) {
    const distFromOrigin = haversineNm(origin.lat, origin.lon, p.lat, p.lon);
    if (
      p.altitude_ft && p.altitude_ft > 500 ||
      (p.groundspeed_kt && p.groundspeed_kt > 30) ||
      distFromOrigin > 3 ||
      statusCode === "DEPARTED" || statusCode === "ENROUTE"
    ) {
      // Could be enroute or climbing
      // Approach detection below may override.
    } else if (!atd) {
      // Not departed yet
      if (statusCode === "BOARDING" || statusCode === "TAXI") return "SCHEDULED";
      if (!statusCode || statusCode === "SCHEDULED") return "SCHEDULED";
    }
  }

  if (!atd && !p) {
  const futureStd = std ? new Date(std).getTime() > Date.now() : false;
  if (futureStd) return "SCHEDULED";
  if (statusCode === "SCHEDULED" || statusCode === "BOARDING") return "SCHEDULED";
  }

  // Approach
  if (p && progress) {
    const remaining = progress.distance_nm_remaining;
    if (remaining <= approachRadiusNm) {
      if ((p.altitude_ft ?? 0) < 10000) return "APPROACH";
    }
  }

  // If landed above returned already; evaluate enroute phases
  if (atd || p) {
    if (p) {
      const remaining = progress?.distance_nm_remaining ?? Infinity;
      if (!isStale(p.timestamp)) {
        if (remaining <= approachRadiusNm) return "APPROACH";
        return "ENROUTE";
      } else {
        return "DEPARTED"; // stale position but we know we left
      }
    }
    return "DEPARTED"; // time-based only
  }

  return statusCode || "UNKNOWN";
}

function landedHeuristic(p: Position): boolean {
  const altOk = (p.altitude_ft ?? 0) < 100;
  const gsOk = (p.groundspeed_kt ?? 0) < 40;
  return p.on_ground === true || (altOk && gsOk);
}

function near(p: Position, a: Airport, rNm: number): boolean {
  const d = haversineNm(p.lat, p.lon, a.lat, a.lon);
  return d <= rNm;
}
