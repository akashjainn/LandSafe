// FlightRow.tsx - Example composite row showing progress bar + status pill.
"use client";
import React from "react";
import { Flight } from "@/lib/realtime/geo";
import { FlightProgressBar } from "./FlightProgressBar";
import { StatusPill } from "./StatusPill";

interface Props { flight: Flight }
export const FlightRow: React.FC<Props> = ({ flight }) => {
  return (
    <div className="grid grid-cols-12 gap-3 items-center py-2 border-b border-slate-200 text-xs md:text-sm">
      <div className="col-span-2 font-semibold">{flight.callsign || flight.number}</div>
      <div className="col-span-2 text-slate-600">{flight.origin.iata || flight.origin.icao} → {flight.diverted_to?.iata || flight.destination.iata || flight.destination.icao}</div>
      <div className="col-span-4"><FlightProgressBar flight={flight} /></div>
      <div className="col-span-2"><StatusPill flight={flight} /></div>
      <div className="col-span-2 text-right pr-2">
        {flight.progress?.eta && <span className="text-slate-500">ETA {new Date(flight.progress.eta).toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'})}</span>}
      </div>
    </div>
  );
};
