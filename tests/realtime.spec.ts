// realtime.spec.ts - Vitest unit tests for geo, progress, status heuristics.
import { describe, it, expect } from 'vitest';
import { haversineNm, Airport, Flight } from "../src/lib/realtime/geo";
import { computeProgress } from "../src/lib/realtime/progress";
import { deriveStatus } from "../src/lib/realtime/status";

function airport(iata: string, lat: number, lon: number): Airport { return { iata, lat, lon }; }

describe('geo distance', () => {
  it('computes zero for same point', () => {
    expect(haversineNm(0,0,0,0)).toBe(0);
  });
  it('handles antimeridian crossing', () => {
    const d1 = haversineNm(10, 179, 10, -179); // should be small (~120 nm)
    expect(d1).toBeLessThan(300);
  });
});

const ORG = airport('AAA', 40, -73);
const DST = airport('BBB', 41, -70);

function baseFlight(): Flight { return { id: 'F1', origin: ORG, destination: DST, current: null, actuals: {}, schedule: {} }; }

describe('progress computation & status heuristics', () => {
  it('scheduled no movement percent 0', () => {
    const f = baseFlight();
    f.schedule = { std: new Date(Date.now() + 30*60000).toISOString(), sta: new Date(Date.now()+ 2*3600_000).toISOString() };
    const p = computeProgress(f);
    expect(p.percent).toBe(0);
    expect(deriveStatus(f, p)).toBe('SCHEDULED');
  });
  it('departed no position uses time interpolation', () => {
    const f = baseFlight();
    f.schedule = { std: new Date(Date.now() - 10*60000).toISOString(), sta: new Date(Date.now()+ 50*60000).toISOString() };
    f.actuals = { atd: new Date(Date.now() - 5*60000).toISOString() };
    const p = computeProgress(f);
    expect(p.percent).toBeGreaterThan(0);
    expect(deriveStatus(f, p)).toBe('DEPARTED');
  });
  it('enroute position percent increases', () => {
    const f = baseFlight();
    f.actuals = { atd: new Date(Date.now()-30*60000).toISOString() };
    f.current = { lat: 40.5, lon: -72, altitude_ft: 30000, groundspeed_kt: 450, timestamp: new Date().toISOString() };
    const p = computeProgress(f);
    expect(p.percent).toBeGreaterThan(10);
    expect(deriveStatus(f, p)).toBe('ENROUTE');
  });
  it('approach within 25nm and <10k ft', () => {
    const f = baseFlight();
    f.actuals = { atd: new Date(Date.now()-60*60000).toISOString() };
    f.current = { lat: 40.9, lon: -70.2, altitude_ft: 8000, groundspeed_kt: 220, timestamp: new Date().toISOString() };
    const p = computeProgress(f);
    expect(deriveStatus(f, p)).toBe('APPROACH');
  });
  it('landed heuristics sets 100', () => {
    const f = baseFlight();
    f.actuals = { atd: new Date(Date.now()-70*60000).toISOString(), ata: new Date().toISOString() };
    f.current = { lat: DST.lat, lon: DST.lon, altitude_ft: 10, groundspeed_kt: 3, on_ground: true, timestamp: new Date().toISOString() };
    const p = computeProgress(f);
    expect(p.percent).toBe(100);
    expect(deriveStatus(f, p)).toBe('LANDED');
  });
  it('diverted recomputes route', () => {
    const f = baseFlight();
    f.diverted_to = airport('ALT', 42, -71);
    f.actuals = { atd: new Date(Date.now()-20*60000).toISOString() };
    f.current = { lat: 41.5, lon: -72, altitude_ft: 20000, groundspeed_kt: 450, timestamp: new Date().toISOString() };
    const p = computeProgress(f);
    expect(p.distance_nm_total).toBeGreaterThan(0);
    expect(deriveStatus(f, p)).toBe('DIVERTED');
  });
  it('stale position treated as departed', () => {
    const f = baseFlight();
    f.actuals = { atd: new Date(Date.now()-30*60000).toISOString() };
    f.current = { lat: 40.5, lon: -72, altitude_ft: 30000, groundspeed_kt: 450, timestamp: new Date(Date.now()-10*600000).toISOString() };
    const p = computeProgress(f);
    expect(deriveStatus(f, p)).toBe('DEPARTED');
  });
  it('origin equals destination shuttle logic', () => {
    const f: Flight = { id: 'SHUTTLE', origin: ORG, destination: ORG, schedule: {}, actuals: { atd: new Date().toISOString() }, current: { lat: ORG.lat, lon: ORG.lon, timestamp: new Date().toISOString() } } as any;
    const p = computeProgress(f);
    expect(p.percent === 0 || p.percent === 100).toBe(true);
  });
  it('progress does not regress on backward position jump', () => {
    const f = baseFlight();
    f.actuals = { atd: new Date(Date.now()-20*60000).toISOString() };
    // Forward position near destination
    f.current = { lat: 40.9, lon: -70.3, altitude_ft: 32000, groundspeed_kt: 450, timestamp: new Date().toISOString() } as any;
    const p1 = computeProgress(f);
  f.progress = p1;
    // simulate erroneous earlier location closer to origin
    f.current = { lat: 40.05, lon: -72.9, altitude_ft: 33000, groundspeed_kt: 440, timestamp: new Date().toISOString() } as any;
    const p2 = computeProgress(f);
    expect(p2.percent).toBe(p1.percent); // stays clamped
  });
  it('taxi after landing remains landed 100%', () => {
    const f = baseFlight();
    f.actuals = { atd: new Date(Date.now()-60*60000).toISOString(), ata: new Date(Date.now()-5*60000).toISOString() };
    f.current = { lat: DST.lat, lon: DST.lon, altitude_ft: 10, groundspeed_kt: 5, on_ground: true, timestamp: new Date().toISOString() } as any;
    const p1 = computeProgress(f);
    expect(p1.percent).toBe(100);
    f.current = { lat: DST.lat+0.001, lon: DST.lon+0.001, altitude_ft: 0, groundspeed_kt: 18, on_ground: true, timestamp: new Date().toISOString() } as any;
    const p2 = computeProgress(f);
    expect(p2.percent).toBe(100);
    expect(deriveStatus(f,p2)).toBe('LANDED');
  });
  it('dateline route distance positive', () => {
    const origin = airport('DAT1', 55, 179.5);
    const dest = airport('DAT2', 55, -179.5);
    const f: Flight = { id: 'DATELINE', origin, destination: dest, schedule: {}, actuals: { atd: new Date(Date.now()-10*60000).toISOString() }, current: { lat: 55, lon: 179.9, altitude_ft: 10000, groundspeed_kt: 300, timestamp: new Date().toISOString() } } as any;
    const p = computeProgress(f);
    expect(p.distance_nm_total).toBeGreaterThan(0);
  });
});
