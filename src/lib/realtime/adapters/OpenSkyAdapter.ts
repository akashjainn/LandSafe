// OpenSkyAdapter.ts - Polls a serverless API route or direct OpenSky integration for positions.
import { Flight } from "../geo";
import { computeProgress } from "../progress";
import { deriveStatus } from "../status";

type OpenSkyStateVector = [
  string, // 0 icao24
  string | null, // 1 callsign
  string | null, // 2 origin_country
  number | null, // 3 time_position
  number | null, // 4 last_contact
  number | null, // 5 longitude
  number | null, // 6 latitude
  number | null, // 7 baro_altitude
  boolean,       // 8 on_ground
  number | null, // 9 velocity (m/s)
  number | null, // 10 true_track
  number | null, // 11 vertical_rate
  number[] | null, // 12 sensors
  number | null, // 13 geo_altitude
  string | null, // 14 squawk
  boolean | null,// 15 spi
  number | null  // 16 position_source
];

export class OpenSkyAdapter {
  private listeners: ((flights: Flight[]) => void)[] = [];
  private timer?: ReturnType<typeof setInterval>;
  private cache: Record<string, Flight> = {};
  constructor(private pollMs = 15000) {
    this.timer = setInterval(() => this.poll(), this.pollMs);
  }
  subscribe(cb: (flights: Flight[]) => void) { this.listeners.push(cb); return () => { this.listeners = this.listeners.filter(l=>l!==cb); }; }
  private emit(f: Flight[]) { this.listeners.forEach(l => l(f)); }
  async poll() {
    try {
      const url = process.env.NEXT_PUBLIC_OPENSKY_PROXY || "/api/debug/aerodatabox"; // reuse route stub if real proxy absent
      const res = await fetch(url);
      if (!res.ok) return;
  const json: { states?: unknown[] } = await res.json();
  const rawStates = Array.isArray(json.states) ? json.states : [];
  const flights: Flight[] = rawStates.slice(0,20).filter(Array.isArray).map((s) => s as OpenSkyStateVector).map((s) => {
        const callsign = (s[1] || '').trim();
        const lat = s[6] ?? undefined; const lon = s[5] ?? undefined;
        const id = callsign || s[0] || Math.random().toString(36).slice(2);
        const origin = { lat: lat||0, lon: lon||0 }; // placeholder unknown
        const destination = { lat: lat||0, lon: lon||0 }; // unknown route
  const altitudeFt = (s[13] || 0) ? (s[13] as number) * 3.28084 : 0;
  const gsKt = (s[9] || 0) ? (s[9] as number) * 1.94384 : 0;
  const f: Flight = { id, callsign, origin, destination, current: lat !== undefined && lon !== undefined ? { lat, lon, altitude_ft: altitudeFt, groundspeed_kt: gsKt, on_ground: s[8], timestamp: new Date().toISOString() } : null };
        const progress = computeProgress(f); f.progress = progress; f.status_code = deriveStatus(f, progress); return f;
      });
      this.cache = { ...this.cache, ...Object.fromEntries(flights.map(f=>[f.id,f])) };
      this.emit(Object.values(this.cache));
  } catch (_e) { /* swallow network errors */ }
  }
}
