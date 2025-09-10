// geo.ts - Geospatial utilities & core real-time flight domain models
// Includes: great-circle distance (Haversine), smoothing helpers, core Flight data model + Zod schemas.
import { z } from 'zod';

export const EARTH_RADIUS_KM = 6371.0088; // IUGG mean earth radius
export const KM_PER_NM = 1.852;
export const NM_PER_KM = 1 / KM_PER_NM; // 0.5399568

export function toRadians(deg: number) {
  return (deg * Math.PI) / 180;
}

export function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;
  const dLat = toRadians(lat2 - lat1);
  // Normalize lon delta across antimeridian
  let dLonDeg = lon2 - lon1;
  if (dLonDeg > 180) dLonDeg -= 360;
  if (dLonDeg < -180) dLonDeg += 360;
  const dLon = toRadians(dLonDeg);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const km = EARTH_RADIUS_KM * c;
  return km * NM_PER_KM;
}

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

// Simple moving average buffer to smooth percent jitter.
export class MovingAverage {
  private values: number[] = [];
  constructor(private size: number) {}
  push(v: number) {
    this.values.push(v);
    if (this.values.length > this.size) this.values.shift();
  }
  mean(): number | undefined {
    if (!this.values.length) return undefined;
    return this.values.reduce((a, b) => a + b, 0) / this.values.length;
  }
  last(): number | undefined { return this.values[this.values.length - 1]; }
  reset() { this.values = []; }
}

export function minutesBetween(isoA?: string, isoB?: string): number | undefined {
  if (!isoA || !isoB) return undefined;
  const a = new Date(isoA).getTime();
  const b = new Date(isoB).getTime();
  if (isNaN(a) || isNaN(b)) return undefined;
  return Math.abs(b - a) / 60000;
}

export function isStale(timestampIso?: string, maxAgeMs = 5 * 60 * 1000): boolean {
  if (!timestampIso) return true;
  const t = new Date(timestampIso).getTime();
  if (isNaN(t)) return true;
  return Date.now() - t > maxAgeMs;
}

// Zod Schemas ---------------------------------------------------------------
export const zAirport = z.object({
  iata: z.string().min(2).max(5).optional(),
  icao: z.string().min(3).max(6).optional(),
  name: z.string().optional(),
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
});
export type Airport = z.infer<typeof zAirport>;

export const zPosition = z.object({
  lat: z.number().gte(-90).lte(90),
  lon: z.number().gte(-180).lte(180),
  altitude_ft: z.number().gte(-1500).lte(60000).optional(),
  groundspeed_kt: z.number().gte(0).lte(1200).optional(),
  on_ground: z.boolean().optional(),
  timestamp: z.string().datetime(),
});
export type Position = z.infer<typeof zPosition>;

export const zSchedule = z.object({
  std: z.string().datetime().optional(),
  sta: z.string().datetime().optional(),
});
export type Schedule = z.infer<typeof zSchedule>;

export const zActuals = z.object({
  atd: z.string().datetime().optional(),
  ata: z.string().datetime().optional(),
  off_block_time: z.string().datetime().optional(),
  on_block_time: z.string().datetime().optional(),
});
export type Actuals = z.infer<typeof zActuals>;

export const zFlightStatus = z.union([
  z.literal("SCHEDULED"),
  z.literal("DEPARTED"),
  z.literal("ENROUTE"),
  z.literal("APPROACH"),
  z.literal("LANDED"),
  z.literal("DIVERTED"),
  z.literal("CANCELLED"),
  z.literal("UNKNOWN"),
  z.literal("BOARDING"),
  z.literal("TAXI"),
]);
export type FlightStatus = z.infer<typeof zFlightStatus>;
export interface Flight {
  id: string;
  callsign?: string; number?: string;
  origin: Airport; destination: Airport;
  schedule?: Schedule; actuals?: Actuals; current?: Position | null;
  status_code?: FlightStatus;
  diverted_to?: Airport | null;
  progress?: ProgressMeta;
}

export interface ProgressMeta {
  percent: number;
  distance_nm_total: number;
  distance_nm_travelled: number;
  distance_nm_remaining: number;
  ete_minutes?: number;
  eta?: string;
  basis: "position" | "time" | "mixed";
  stale?: boolean;
  diverted?: boolean;
  estimated?: boolean; // time-based interpolation marker
}

export const zProgressMeta = z.object({
  percent: z.number().gte(0).lte(100),
  distance_nm_total: z.number().gte(0),
  distance_nm_travelled: z.number().gte(0),
  distance_nm_remaining: z.number().gte(0),
  ete_minutes: z.number().gte(0).optional(),
  eta: z.string().datetime().optional(),
  basis: z.enum(["position","time","mixed"]),
  stale: z.boolean().optional(),
  diverted: z.boolean().optional(),
  estimated: z.boolean().optional(),
});

export const zFlight = z.object({
  id: z.string(),
  callsign: z.string().optional(),
  number: z.string().optional(),
  origin: zAirport,
  destination: zAirport,
  diverted_to: zAirport.optional().nullable(),
  schedule: zSchedule.optional(),
  actuals: zActuals.optional(),
  current: zPosition.optional().nullable(),
  status_code: zFlightStatus.optional(),
});

// Helper validate functions
export function parseFlight(data: unknown): Flight { return zFlight.parse(data); }
export function parseFlights(data: unknown): Flight[] { return z.array(zFlight).parse(data); }
