// AeroAPIAdapter.ts - FlightAware AeroAPI integration stub with pluggable mapping.
import { Flight } from "../geo";
import { computeProgress } from "../progress";
import { deriveStatus } from "../status";

interface AeroAPIRawFlight { ident: string; origin?: { code: string; lat: number; lon: number }; destination?: { code: string; lat: number; lon: number }; actual_off?: string; actual_on?: string; scheduled_out?: string; scheduled_in?: string; diverted?: boolean; fa_flight_id?: string; last_position?: { latitude: number; longitude: number; altitude: number; groundspeed: number; timestamp: string; }; }

export class AeroAPIAdapter {
  private listeners: ((flights: Flight[]) => void)[] = [];
  private timer?: any;
  private cache: Record<string, Flight> = {};
  constructor(private pollMs = 15000) { this.timer = setInterval(()=>this.poll(), this.pollMs); }
  subscribe(cb: (flights: Flight[]) => void) { this.listeners.push(cb); cb(Object.values(this.cache)); return () => { this.listeners = this.listeners.filter(l=>l!==cb); }; }
  private emit(list: Flight[]) { this.listeners.forEach(l=>l(list)); }
  async poll() {
    const endpoint = process.env.NEXT_PUBLIC_AEROAPI_ENDPOINT;
    const key = process.env.NEXT_PUBLIC_AEROAPI_KEY;
    if (!endpoint || !key) return; // not configured
    try {
      const res = await fetch(endpoint, { headers: { 'x-apikey': key }});
      if (!res.ok) return;
      const json = await res.json();
      const raws: AeroAPIRawFlight[] = json.flights || [];
      const mapped: Flight[] = raws.map(r => mapAero(r)).map(f => { const progress = computeProgress(f); f.progress = progress; f.status_code = deriveStatus(f, progress); return f; });
      for (const f of mapped) this.cache[f.id] = f;
      this.emit(Object.values(this.cache));
    } catch (e) { /* ignore */ }
  }
}

function mapAero(r: AeroAPIRawFlight): Flight {
  const origin = r.origin ? { iata: r.origin.code, lat: r.origin.lat, lon: r.origin.lon } : { lat: 0, lon: 0 } as any;
  const destination = r.destination ? { iata: r.destination.code, lat: r.destination.lat, lon: r.destination.lon } : { lat: 0, lon: 0 } as any;
  const current = r.last_position ? { lat: r.last_position.latitude, lon: r.last_position.longitude, altitude_ft: r.last_position.altitude, groundspeed_kt: r.last_position.groundspeed, timestamp: r.last_position.timestamp } : null;
  return { id: r.fa_flight_id || r.ident, callsign: r.ident, origin, destination, current, actuals: { atd: r.actual_off, ata: r.actual_on }, schedule: { std: r.scheduled_out, sta: r.scheduled_in }, diverted_to: r.diverted ? destination : null } as any;
}
