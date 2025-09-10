// FlightProgressBar.tsx - Accessible flight progress bar with tooltip data.
"use client";
import React from "react";
import { cn } from "@/lib/utils";
import { Flight } from "@/lib/realtime/geo";

interface Props { flight: Flight; className?: string; }

export const FlightProgressBar: React.FC<Props> = ({ flight, className }) => {
  const progress = flight.progress;
  const percent = progress?.percent ?? 0;
  const status = flight.status_code || "UNKNOWN";
  const label = `${percent}% — ${statusLabel(status)}`;
  const tooltip = buildTooltip(flight);
  const color = statusColor(status, progress?.estimated, progress?.diverted);
  return (
    <div className={cn("w-full", className)}>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label={`Flight ${flight.callsign || flight.number || flight.id} progress`}
        className={cn("relative h-3 rounded bg-slate-200 overflow-hidden", color.bg)}
        title={tooltip}
      >
        <div className={cn("absolute inset-y-0 left-0 transition-all", color.fg)} style={{ width: `${percent}%` }} />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] font-medium text-slate-800 select-none">
          {label}{progress?.estimated ? " *" : ""}
        </div>
      </div>
      {progress?.estimated && <span className="mt-1 block text-[10px] text-slate-500">* estimated</span>}
      {progress?.diverted && <span className="mt-1 block text-[10px] text-amber-600">Diverted to {flight.diverted_to?.iata || flight.diverted_to?.icao}</span>}
    </div>
  );
};

function statusLabel(s: string) { return s.charAt(0) + s.slice(1).toLowerCase(); }
function statusColor(status: string, estimated?: boolean, diverted?: boolean) {
  if (status === "LANDED") return { bg: "bg-emerald-200", fg: "bg-emerald-500" };
  if (status === "CANCELLED") return { bg: "bg-slate-300", fg: "bg-slate-500" };
  if (diverted || status === "DIVERTED") return { bg: "bg-orange-200", fg: "bg-orange-500" };
  if (estimated && status !== "DEPARTED") return { bg: "bg-slate-200", fg: "bg-slate-400" };
  if (status === "APPROACH") return { bg: "bg-indigo-200", fg: "bg-indigo-500" };
  if (status === "DEPARTED" || status === "ENROUTE") return { bg: "bg-blue-200", fg: "bg-blue-500" };
  return { bg: "bg-slate-200", fg: "bg-slate-400" };
}

function buildTooltip(f: Flight): string {
  const p = f.progress;
  if (!p) return "No progress data";
  const lines = [
    `Progress: ${p.percent}% (${p.basis})`,
    `Distance: ${p.distance_nm_travelled.toFixed(1)} / ${p.distance_nm_total.toFixed(1)} nm (${p.distance_nm_remaining.toFixed(1)} remaining)`,
  ];
  if (p.ete_minutes) lines.push(`ETE: ${p.ete_minutes.toFixed(0)} min`);
  if (p.eta) lines.push(`ETA: ${formatLocal(p.eta)} (${p.eta})`);
  if (p.stale) lines.push("Last pos: stale");
  return lines.join("\n");
}
function formatLocal(iso: string) {
  try { return new Date(iso).toLocaleTimeString(undefined,{hour:"2-digit",minute:"2-digit"}); } catch { return iso; }
}
