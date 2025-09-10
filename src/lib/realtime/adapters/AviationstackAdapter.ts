// AviationstackAdapter.ts - Polls Aviationstack REST API; maps to Flight.
import { Flight } from "../geo";
import { computeProgress } from "../progress";
import { deriveStatus } from "../status";

interface AviationstackRaw { flight_date: string; flight_status: string; flight: { iata?: string }; departure?: { scheduled?: string; actual?: string; airport?: string; }; arrival?: { scheduled?: string; actual?: string; airport?: string; }; live?: { latitude: number; longitude: number; altitude: number; speed_horizontal: number; is_ground: boolean; updated: string; }; }

export class AviationstackAdapter {
  private listeners: ((flights: Flight[]) => void)[] = [];
  private timer?: ReturnType<typeof setInterval>; private cache: Record<string, Flight> = {};
  constructor(private pollMs=15000) { this.timer = setInterval(()=>this.poll(), this.pollMs); }
  subscribe(cb: (flights: Flight[]) => void) { this.listeners.push(cb); cb(Object.values(this.cache)); return () => { this.listeners = this.listeners.filter(l=>l!==cb); }; }
  private emit(list: Flight[]) { this.listeners.forEach(l=>l(list)); }
  async poll() {
    const key = process.env.NEXT_PUBLIC_AVSTACK_KEY; const endpoint = process.env.NEXT_PUBLIC_AVSTACK_ENDPOINT;
    if (!key || !endpoint) return;
    try {
      const res = await fetch(`${endpoint}?access_key=${key}`);
      if (!res.ok) return;
      const json: unknown = await res.json();
      let raws: AviationstackRaw[] = [];
      if (json && typeof json === 'object') {
        const maybeData = (json as Record<string, unknown>)['data'];
        if (Array.isArray(maybeData)) {
          raws = maybeData.filter(r => r && typeof r === 'object').map(r => r as AviationstackRaw);
        }
      }
      const mapped: Flight[] = raws.map(mapAv).map(f=>{ const progress = computeProgress(f); f.progress = progress; f.status_code = deriveStatus(f, progress); return f; });
      for (const f of mapped) this.cache[f.id]=f;
      this.emit(Object.values(this.cache));
    } catch { /* ignore network errors */ }
  }
}

function mapAv(r: AviationstackRaw): Flight {
  const origin = { name: r.departure?.airport, lat: 0, lon: 0 }; // basic plan may omit coordinates
  const destination = { name: r.arrival?.airport, lat: 0, lon: 0 };
  const live = r.live;
  const current = live ? { lat: live.latitude, lon: live.longitude, altitude_ft: live.altitude, groundspeed_kt: live.speed_horizontal, on_ground: live.is_ground, timestamp: live.updated } : null;
  return { id: r.flight.iata || r.flight_date + Math.random(), callsign: r.flight.iata, origin, destination, current, schedule: { std: r.departure?.scheduled, sta: r.arrival?.scheduled }, actuals: { atd: r.departure?.actual, ata: r.arrival?.actual }, status_code: r.flight_status ? r.flight_status.toUpperCase() as Flight['status_code'] : undefined };
}
