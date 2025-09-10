"use client";
// useRealtimeFlight.ts - Polls backend realtime endpoint for a flight and derives convenience flags.
import { useEffect, useRef, useState } from 'react';

export interface RealtimeFlightData {
  flightId: string;
  carrierIata: string;
  flightNumber: string;
  status?: string;
  progress: { percent: number; basis: string; departed: boolean; landed: boolean; eta?: string; etd?: string };
  times?: { schedDep?: string; schedArr?: string; estDep?: string; estArr?: string; actDep?: string; actArr?: string };
}

interface Result {
  data: RealtimeFlightData | null;
  loading: boolean;
  error: string | null;
  lastUpdated?: number;
}

export function useRealtimeFlight(flightId?: string, intervalMs = 60000): Result {
  const [data, setData] = useState<RealtimeFlightData | null>(null);
  const [loading, setLoading] = useState(!!flightId);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!flightId) return;

    let cancelled = false;

    async function load() {
      try {
        if (!data) setLoading(true);
        const res = await fetch(`/api/flights/${flightId}/realtime`, { cache: 'no-store' });
        const json = await res.json();
        if (cancelled) return;
        if (json.success && json.data) {
          setData(json.data);
          setError(null);
          // Stop polling once landed
          if (json.data.progress?.landed && timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
        } else {
          setError(json.error || 'Unavailable');
        }
      } catch {
        if (!cancelled) setError('Network error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    if (intervalMs > 0) {
      timerRef.current = setInterval(load, intervalMs);
    }
    return () => {
      cancelled = true;
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flightId]);

  return { data, loading, error, lastUpdated: data ? Date.now() : undefined };
}
