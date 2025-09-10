// StatusPill.tsx - Visual pill for flight status including Departed/Landed emphasis.
"use client";
import React from "react";
import { Flight } from "@/lib/realtime/geo";
import { cn } from "@/lib/utils";
import { PlaneTakeoff, PlaneLanding, Plane } from "lucide-react";

interface Props { flight: Flight; className?: string; }
export const StatusPill: React.FC<Props> = ({ flight, className }) => {
  const status = flight.status_code || "UNKNOWN";
  const { fg, bg, icon: Icon } = styleFor(status);
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", bg, fg, className)} aria-label={`Status ${status}`}> 
      <Icon className="w-3 h-3" aria-hidden="true" />
      <span>{label(status)}</span>
      <span className="sr-only">Flight status: {label(status)}</span>
    </span>
  );
};

function label(s: string) { return s === "ENROUTE" ? "Enroute" : s.charAt(0) + s.slice(1).toLowerCase(); }
function styleFor(status: string) {
  switch (status) {
    case "DEPARTED": return { fg: "text-blue-800", bg: "bg-blue-100", icon: PlaneTakeoff };
    case "ENROUTE": return { fg: "text-sky-800", bg: "bg-sky-100", icon: Plane };
    case "APPROACH": return { fg: "text-indigo-800", bg: "bg-indigo-100", icon: Plane };
    case "LANDED": return { fg: "text-emerald-800", bg: "bg-emerald-100", icon: PlaneLanding };
    case "DIVERTED": return { fg: "text-orange-800", bg: "bg-orange-100", icon: Plane };
    case "CANCELLED": return { fg: "text-slate-800", bg: "bg-slate-300", icon: Plane };
    default: return { fg: "text-slate-800", bg: "bg-slate-100", icon: Plane };
  }
}
