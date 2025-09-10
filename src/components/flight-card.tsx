import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Clock, MapPin, Plane } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { ProviderBadge } from "@/components/provider-badge";
import { Card } from "@/components/ui/card";
import Link from "next/link";

// Optional real-time progress shape (mirrors realtime Flight.progress)
interface OptionalProgress { percent?: number }

interface Flight {
  id: string;
  flightNumber: string;
  airline: string;
  originIata?: string;
  destIata?: string;
  latestSchedDep?: Date | string | null;
  latestSchedArr?: Date | string | null;
  latestEstDep?: Date | string | null;
  latestEstArr?: Date | string | null;
  latestStatus?: string;
  gate?: string;
  terminal?: string;
  updatedAt: Date | string;
  progress?: OptionalProgress; // optionally injected
}

interface FlightCardProps {
  flight: Flight;
  className?: string;
}

export function FlightCard({ flight, className }: FlightCardProps) {
  const formatTime = (date?: Date | string | null) => {
    if (!date) return "—";
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return format(d, "HH:mm");
    } catch {
      return "—";
    }
  };

  const getLastUpdated = () => {
    try {
      const date = typeof flight.updatedAt === 'string' ? new Date(flight.updatedAt) : flight.updatedAt;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  // Compute a lightweight percent if progress not provided, based on scheduled window
  const computeFallbackPercent = (): number => {
    const dep = flight.latestSchedDep || flight.latestEstDep;
    const arr = flight.latestSchedArr || flight.latestEstArr;
    if (!dep || !arr) return 0;
    const depMs = new Date(dep).getTime();
    const arrMs = new Date(arr).getTime();
    const now = Date.now();
    if (isNaN(depMs) || isNaN(arrMs) || arrMs <= depMs) return 0;
    if (now <= depMs) return 0;
    if (now >= arrMs) return 99;
    return Math.min(99, Math.max(0, Math.round(((now - depMs) / (arrMs - depMs)) * 100)));
  };
  const percent = flight.progress?.percent ?? computeFallbackPercent();

  return (
    <Link href={`/flight/${flight.id}`} prefetch className="block group focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-md">
    <Card className={cn(
      "p-4 hover:shadow-md transition-shadow cursor-pointer relative",
      className
    )} role="group" aria-label={`Flight card ${flight.flightNumber}`}>      
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-slate-900">
          {flight.flightNumber}
        </div>
        <StatusBadge status={flight.latestStatus} />
      </div>

      <div className="space-y-3">
        {/* Route */}
        <div className="flex items-center gap-2 text-sm">
          <div className="font-medium text-slate-900">
            {flight.originIata || "—"}
          </div>
          <ArrowRight className="h-3 w-3 text-slate-400" />
          <div className="font-medium text-slate-900">
            {flight.destIata || "—"}
          </div>
        </div>

        {/* Inline miniature progress track with moving airplane */}
        <div className="mt-1 mb-2">
          <div className="relative h-2 rounded bg-slate-200 overflow-hidden" aria-label="progress miniature" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
            <div className="absolute inset-y-0 left-0 bg-slate-300" style={{ width: `${percent}%` }} />
            <Plane className="absolute -top-2 h-4 w-4 text-sky-600 transition-all duration-500 ease-out" style={{ left: `calc(${percent}% - 8px)` }} aria-hidden="true" />
          </div>
          <span className="sr-only">Progress {percent}%</span>
        </div>

        {/* Times */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Scheduled</div>
            <div className="text-slate-700">
              {formatTime(flight.latestSchedDep)} → {formatTime(flight.latestSchedArr)}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500 mb-1">Estimated</div>
            <div className="text-slate-700">
              {formatTime(flight.latestEstDep)} → {formatTime(flight.latestEstArr)}
            </div>
          </div>
        </div>

        {/* Gate & Terminal */}
        <div className="flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1">
            <MapPin className="h-3 w-3" />
            <span>Gate {flight.gate || "—"} · Term {flight.terminal || "—"}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            <span>Updated {getLastUpdated()}</span>
          </div>
        </div>

        {/* Provider */}
        <div className="flex justify-end">
          <ProviderBadge provider="AeroDataBox" isActive />
        </div>
      </div>
  </Card>
  </Link>
  );
}
