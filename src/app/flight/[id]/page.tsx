// Flight detail page displaying progress UI
"use client";
import React, { useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useFlightStore } from '@/lib/realtime/store/useFlightStore';
import { MockAdapter } from '@/lib/realtime/adapters/MockAdapter';
import { FlightProgressBar } from '@/components/FlightProgressBar';
import { StatusPill } from '@/components/StatusPill';

export default function FlightDetailPage() {
  const params = useParams();
  const flightId = params?.id as string;
  const { flights, order, setAdapter } = useFlightStore();

  useEffect(() => {
    // If no adapter yet, spin up Mock to demonstrate.
    if (!Object.keys(flights).length) {
      setAdapter(new MockAdapter() as any);
    }
  }, [flights, setAdapter]);

  const flight = flights[flightId];

  if (!flight) {
    return <div className="p-6 text-sm text-slate-600">Loading flight {flightId}…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Flight {flight.callsign || flight.number || flight.id}</h1>
        <p className="text-slate-500 text-sm">{flight.origin.iata || flight.origin.icao} → {flight.diverted_to?.iata || flight.destination.iata || flight.destination.icao}</p>
      </div>

      <div className="flex items-center gap-3">
        <StatusPill flight={flight} />
        {flight.progress?.eta && (
          <span className="text-xs text-slate-500">ETA {new Date(flight.progress.eta).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span>
        )}
        {flight.progress?.estimated && <span className="text-[10px] uppercase tracking-wide text-slate-400">Estimated</span>}
      </div>

      <FlightProgressBar flight={flight} />

      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="p-3 rounded border bg-white/50">
          <h2 className="font-medium mb-1">Route</h2>
          <div>{flight.origin.iata || flight.origin.icao} → {flight.diverted_to?.iata || flight.destination.iata || flight.destination.icao}</div>
          {flight.diverted_to && <div className="text-amber-600 text-xs mt-1">Diverted</div>}
        </div>
        <div className="p-3 rounded border bg-white/50">
          <h2 className="font-medium mb-1">Progress Metrics</h2>
          {flight.progress && (
            <ul className="space-y-0.5">
              <li>Percent: {flight.progress.percent}% ({flight.progress.basis})</li>
              <li>Distance: {flight.progress.distance_nm_travelled.toFixed(1)} / {flight.progress.distance_nm_total.toFixed(1)} nm</li>
              <li>Remaining: {flight.progress.distance_nm_remaining.toFixed(1)} nm</li>
              {flight.progress.ete_minutes && <li>ETE: {flight.progress.ete_minutes.toFixed(0)} min</li>}
              {flight.progress.eta && <li>ETA: {new Date(flight.progress.eta).toLocaleTimeString()}</li>}
              {flight.progress.stale && <li className="text-amber-600">Position Stale</li>}
            </ul>
          )}
        </div>
        <div className="p-3 rounded border bg-white/50">
          <h2 className="font-medium mb-1">Current Position</h2>
          {flight.current ? (
            <ul className="space-y-0.5">
              <li>Lat/Lon: {flight.current.lat.toFixed(3)}, {flight.current.lon.toFixed(3)}</li>
              {flight.current.altitude_ft && <li>Alt: {Math.round(flight.current.altitude_ft)} ft</li>}
              {flight.current.groundspeed_kt && <li>GS: {Math.round(flight.current.groundspeed_kt)} kt</li>}
              <li>Updated: {new Date(flight.current.timestamp).toLocaleTimeString()}</li>
            </ul>
          ) : <div className="text-slate-500 text-xs">No position yet</div>}
        </div>
      </div>

      <div className="pt-4 border-t text-xs text-slate-400">Flight detail preview · Demo data (MockAdapter).</div>
    </div>
  );
}
