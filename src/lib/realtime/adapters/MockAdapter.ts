// MockAdapter.ts - Generates synthetic mixed-state flights for demo & tests.
import { Flight, Airport } from "../geo";

function airport(iata: string, lat: number, lon: number): Airport { return { iata, lat, lon }; }

// Sample airports
const JFK = airport("JFK", 40.6413, -73.7781);
const LAX = airport("LAX", 33.9416, -118.4085);
const SFO = airport("SFO", 37.6213, -122.3790);
const SEA = airport("SEA", 47.4502, -122.3088);
const BOS = airport("BOS", 42.3656, -71.0096);
const DEN = airport("DEN", 39.8561, -104.6737);
const ORD = airport("ORD", 41.9742, -87.9073);
const MIA = airport("MIA", 25.7959, -80.2870);
const ATL = airport("ATL", 33.6407, -84.4277);

export class MockAdapter {
  private interval?: ReturnType<typeof setInterval>;
  private listeners: ((flights: Flight[]) => void)[] = [];
  private flights: Flight[] = [];

  constructor() {
    this.flights = this.seed();
    // Simulate periodic position updates
    this.interval = setInterval(() => {
      this.tick();
      this.emit();
    }, 8000);
  }

  subscribe(cb: (flights: Flight[]) => void) {
    this.listeners.push(cb);
    cb(this.flights);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== cb);
    };
  }

  refresh() { this.emit(); return Promise.resolve(); }

  private emit() { this.listeners.forEach((l) => l(this.flights)); }

  private seed(): Flight[] {
    const now = Date.now();
    const iso = (ms: number) => new Date(ms).toISOString();
    const oneHour = 3600_000;

    return [
      // 1 Scheduled (no departure yet)
      {
        id: "MOCK1",
        callsign: "AA100",
        origin: JFK,
        destination: LAX,
        schedule: { std: iso(now + 20 * 60_000), sta: iso(now + 6 * oneHour) },
        actuals: {},
        current: null,
      },
      // 2 Departed, no current position yet (time-based percent)
      {
        id: "MOCK2",
        callsign: "DL200",
        origin: BOS,
        destination: SEA,
        schedule: { std: iso(now - 10 * 60_000), sta: iso(now + 5 * oneHour) },
        actuals: { atd: iso(now - 5 * 60_000) },
        current: null,
      },
      // 3 Enroute normal
      {
        id: "MOCK3",
        callsign: "UA300",
        origin: DEN,
        destination: ORD,
        schedule: { std: iso(now - oneHour), sta: iso(now + oneHour) },
        actuals: { atd: iso(now - 50 * 60_000) },
        current: { lat: 41.0, lon: -95, altitude_ft: 34000, groundspeed_kt: 470, timestamp: iso(now) },
      },
      // 4 Approach
      {
        id: "MOCK4",
        callsign: "SW400",
        origin: ATL,
        destination: MIA,
        schedule: { std: iso(now - 90 * 60_000), sta: iso(now + 15 * 60_000) },
        actuals: { atd: iso(now - 80 * 60_000) },
        current: { lat: 25.95, lon: -80.4, altitude_ft: 8000, groundspeed_kt: 260, timestamp: iso(now) },
      },
      // 5 Landed
      {
        id: "MOCK5",
        callsign: "BA500",
        origin: SFO,
        destination: JFK,
        schedule: { std: iso(now - 7 * oneHour), sta: iso(now - 1 * oneHour) },
        actuals: { atd: iso(now - 6.5 * oneHour), ata: iso(now - 30 * 60_000) },
        current: { lat: 40.64, lon: -73.78, altitude_ft: 20, groundspeed_kt: 5, on_ground: true, timestamp: iso(now) },
      },
      // 6 Diverted mid-air
      {
        id: "MOCK6",
        callsign: "AF600",
        origin: JFK,
        destination: LAX,
        diverted_to: SFO,
        schedule: { std: iso(now - 2 * oneHour), sta: iso(now + 3 * oneHour) },
        actuals: { atd: iso(now - 110 * 60_000) },
        current: { lat: 38.0, lon: -121.5, altitude_ft: 28000, groundspeed_kt: 430, timestamp: iso(now) },
      },
      // 7 Cancelled example (not in 6 list but for completeness)
      {
        id: "MOCK7",
        callsign: "LH700",
        origin: JFK,
        destination: LAX,
        schedule: { std: iso(now + 60 * 60_000), sta: iso(now + 7 * oneHour) },
        status_code: "CANCELLED",
        actuals: {},
        current: null,
      },
    ];
  }

  private tick() {
    const nowIso = new Date().toISOString();
    // Advance enroute flights
    for (const f of this.flights) {
      if (!f.current) continue;
      if (f.status_code === "LANDED") continue;
      // simple west-east or north-east drift
      f.current = { ...f.current, lon: f.current.lon - 0.5, timestamp: nowIso };
    }
  }
}
