// Flight detail page displaying progress UI
"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { cn } from '@/lib/utils';

interface RealtimeFlightResponse {
  success: boolean;
  data?: {
    flightId: string;
    carrierIata: string;
    flightNumber: string;
    originIata?: string;
    destIata?: string;
    status?: string;
    progress: { percent: number; basis: string; departed: boolean; landed: boolean; eta?: string; etd?: string };
    times?: { schedDep?: string; schedArr?: string; estDep?: string; estArr?: string; actDep?: string; actArr?: string };
  };
  error?: string;
}

export default function FlightDetailPage() {
  const params = useParams();
  const flightId = params?.id as string;
  const [rt, setRt] = useState<RealtimeFlightResponse['data'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
  const timer: ReturnType<typeof setInterval> = setInterval(() => {}, 0); // placeholder assign, will be cleared and re-set
  clearInterval(timer); // immediately clear placeholder
    async function load() {
      try {
        setLoading(true);
        const res = await fetch(`/api/flights/${flightId}/realtime`, { cache: 'no-store' });
        const json: RealtimeFlightResponse = await res.json();
        if (json.success && json.data) {
          setRt(json.data);
          setError(null);
        } else {
          setError(json.error || 'Not found');
        }
  } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }
    load();
  const realTimer = setInterval(load, 60000); // poll every 60s
  return () => clearInterval(realTimer);
  }, [flightId]);

  if (loading && !rt) return <div className="p-6 text-sm text-slate-600">Loading flight {flightId}…</div>;
  if (error) return <div className="p-6 text-sm text-red-600">{error}</div>;
  if (!rt) return <div className="p-6 text-sm text-slate-600">No data</div>;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Flight {rt.carrierIata}{rt.flightNumber}</h1>
        <p className="text-slate-500 text-sm">{rt.originIata || '???'} → {rt.destIata || '???'}</p>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', rt.progress.departed ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500')}>Departed</span>
        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', rt.progress.landed ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500')}>Landed</span>
        {rt.status && <span className="ml-1 text-xs text-slate-500">Status: {rt.status}</span>}
        {rt.progress.eta && <span className="text-xs text-slate-500">ETA {new Date(rt.progress.eta).toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',hour12:true})}</span>}
      </div>

      <div>
        <div className="mb-1 text-xs font-medium text-slate-600">Progress</div>
        <div className="h-3 w-full rounded bg-slate-200 overflow-hidden relative">
          <div className="h-full bg-sky-500 transition-all" style={{ width: `${rt.progress.percent}%` }} />
          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-slate-700 mix-blend-overlay">
            {rt.progress.percent}%
          </div>
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-wide text-slate-400">Time-based</div>
      </div>

      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="p-3 rounded border bg-white/50">
          <h2 className="font-medium mb-1">Route</h2>
          <div>{rt.originIata || '???'} → {rt.destIata || '???'}</div>
        </div>
        <div className="p-3 rounded border bg-white/50">
          <h2 className="font-medium mb-1">Progress Metrics</h2>
          <ul className="space-y-0.5">
            <li>Percent: {rt.progress.percent}% (time)</li>
            <li>Departed: {rt.progress.departed ? 'Yes' : 'No'}</li>
            <li>Landed: {rt.progress.landed ? 'Yes' : 'No'}</li>
            {rt.progress.eta && <li>ETA: {new Date(rt.progress.eta).toLocaleTimeString(undefined,{hour12:true})}</li>}
            {rt.times?.actDep && <li>Actual Off: {new Date(rt.times.actDep).toLocaleTimeString(undefined,{hour12:true})}</li>}
            {rt.times?.actArr && <li>Actual On: {new Date(rt.times.actArr).toLocaleTimeString(undefined,{hour12:true})}</li>}
          </ul>
        </div>
        <div className="p-3 rounded border bg-white/50">
          <h2 className="font-medium mb-1">Current Position</h2>
          <div className="text-slate-500 text-xs">Provider position not integrated in this endpoint (time-based only).</div>
        </div>
      </div>

      <div className="pt-4 border-t text-xs text-slate-400">Flight detail · Real-time (time-based) progress derived from AeroDataBox schedule/estimate/actual times.</div>
    </div>
  );
}
