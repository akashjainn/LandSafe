// progress.ts - Compute flight progress with position or schedule interpolation.
import { Flight, ProgressMeta, haversineNm, clamp, MovingAverage, isStale } from "./geo";
import { deriveStatus } from "./status";

// Maintain moving averages + last percent per flight id
const percentSmoothers: Record<string, MovingAverage> = {};
const lastPercents: Record<string, number> = {};

export interface ProgressOptions {
  smoothingWindow?: number; // number of samples to average
}

export function computeProgress(flight: Flight, opts: ProgressOptions = {}): ProgressMeta {
  const origin = flight.origin;
  const dest = flight.diverted_to || flight.destination;
  const current = flight.current;
  const atd = flight.actuals?.atd || flight.actuals?.off_block_time;
  const ata = flight.actuals?.ata || flight.actuals?.on_block_time;
  const scheduleStd = flight.schedule?.std;
  const scheduleSta = flight.schedule?.sta;

  let distance_nm_total = haversineNm(origin.lat, origin.lon, dest.lat, dest.lon);
  if (distance_nm_total < 0.5) distance_nm_total = 0; // treat as shuttle
  let distance_nm_travelled = 0;
  let distance_nm_remaining = distance_nm_total;
  let percent = 0;
  let basis: ProgressMeta["basis"] = "position";
  let eta: string | undefined;
  let ete_minutes: number | undefined;
  let estimated = false;
  const stale = current ? isStale(current.timestamp) : true;

  if (ata) {
    percent = 100;
    distance_nm_travelled = distance_nm_total;
    distance_nm_remaining = 0;
    basis = "position";
  } else if (current && !stale && distance_nm_total > 0) {
    distance_nm_travelled = haversineNm(origin.lat, origin.lon, current.lat, current.lon);
    if (distance_nm_travelled > distance_nm_total) distance_nm_travelled = Math.min(distance_nm_travelled, distance_nm_total * 1.05); // small overshoot tolerance
    distance_nm_remaining = Math.max(0, distance_nm_total - distance_nm_travelled);
    percent = clamp(Math.round((distance_nm_travelled / distance_nm_total) * 100), 0, 100);
    basis = "position";
    // crude ETA: remaining / groundspeed
    if (current.groundspeed_kt && current.groundspeed_kt > 50 && distance_nm_remaining > 1) {
      ete_minutes = (distance_nm_remaining / current.groundspeed_kt) * 60;
      eta = new Date(Date.now() + ete_minutes * 60000).toISOString();
    }
  } else if (atd) {
    // time-based interpolation if we departed but no position yet
    if (scheduleSta) {
      const depMs = new Date(atd).getTime();
      const arrMs = new Date(scheduleSta).getTime();
      const now = Date.now();
      if (isFinite(depMs) && isFinite(arrMs) && arrMs > depMs) {
        const frac = clamp((now - depMs) / (arrMs - depMs), 0, 0.99);
        percent = Math.round(frac * 100);
        basis = "time";
        estimated = true;
      }
    } else {
      percent = 5; // minimal indication of movement
      basis = "time";
      estimated = true;
    }
  } else if (scheduleStd && scheduleSta) {
    // purely scheduled estimate pre-departure
    const depMs = new Date(scheduleStd).getTime();
    const arrMs = new Date(scheduleSta).getTime();
    const now = Date.now();
    if (now < depMs) percent = 0;
    else if (now > arrMs) percent = 99;
    else {
      const frac = clamp((now - depMs) / (arrMs - depMs), 0, 0.99);
      percent = Math.round(frac * 100);
    }
    basis = "time";
    estimated = true;
  }

  // smoothing + regression guard
  const key = flight.id + (flight.diverted_to ? "#" + (flight.diverted_to.iata || flight.diverted_to.icao) : "");
  const smoother = (percentSmoothers[key] = percentSmoothers[key] || new MovingAverage(opts.smoothingWindow || 3));
  const previous = flight.progress?.percent ?? lastPercents[key];
  const rawPercent = percent;
  if (previous !== undefined && rawPercent < previous) {
    // Regression detected: reset smoothing buffer to previous only.
    percent = previous;
    smoother.reset();
    smoother.push(previous);
  }
  const lastMean = smoother.mean();
  if (lastMean !== undefined && percent < lastMean && percent !== 100) {
    percent = Math.round(lastMean);
  }
  smoother.push(percent);
  const smoothed = smoother.mean();
  if (smoothed !== undefined) percent = Math.round(smoothed);
  lastPercents[key] = percent;

  // If landed ensure 100
  const status = deriveStatus(flight, { percent, distance_nm_remaining, distance_nm_total, distance_nm_travelled, basis, ete_minutes, eta });
  if (status === "LANDED") percent = 100;

  return {
    percent,
    distance_nm_total: distance_nm_total,
    distance_nm_travelled,
    distance_nm_remaining,
    ete_minutes,
    eta,
    basis,
    stale,
    diverted: !!flight.diverted_to,
    estimated,
  };
}
