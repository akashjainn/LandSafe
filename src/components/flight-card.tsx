import { format, formatDistanceToNow } from "date-fns";
import { Clock, MapPin, Plane, RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { ProviderBadge } from "@/components/provider-badge";
import Link from "next/link";
import { formatAirportWithCity } from "@/lib/airports";

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
  passengerName?: string; // optional passenger or journey name
  originTerminal?: string | null;
  destTerminal?: string | null;
  originGate?: string | null;
  destGate?: string | null;
}

interface FlightCardProps {
  flight: Flight;
  className?: string;
}

export function FlightCard({ flight, className }: FlightCardProps) {
  const formatTime = (date?: Date | string | null) => {
    if (!date) return "—";
    try {
      const d = typeof date === "string" ? new Date(date) : date;
      return format(d, "HH:mm");
    } catch {
      return "—";
    }
  };

  const getLastUpdated = () => {
    try {
      const date = typeof flight.updatedAt === "string" ? new Date(flight.updatedAt) : flight.updatedAt;
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return "Unknown";
    }
  };

  // Fallback progress
  const computeFallbackPercent = (): number => {
    const dep = flight.latestSchedDep || flight.latestEstDep;
    const arr = flight.latestSchedArr || flight.latestEstArr;
    if (!dep || !arr) return 0;
    const depMs = new Date(dep).getTime();
    const arrMs = new Date(arr).getTime();
    const now = Date.now();
    if (isNaN(depMs) || isNaN(arrMs) || arrMs <= depMs) return 0;
    if (now <= depMs) return 0;
    if (now >= arrMs) return 100;
    return Math.min(100, Math.max(0, Math.round(((now - depMs) / (arrMs - depMs)) * 100)));
  };
  const percent = flight.progress?.percent ?? computeFallbackPercent();

  const originInfo = flight.originIata ? formatAirportWithCity(flight.originIata) : undefined;
  const destInfo = flight.destIata ? formatAirportWithCity(flight.destIata) : undefined;
  const originCity = originInfo ? ("city" in originInfo && originInfo.city ? `${originInfo.city}` : originInfo.code) : undefined;
  const destCity = destInfo ? ("city" in destInfo && destInfo.city ? `${destInfo.city}` : destInfo.code) : undefined;

  return (
    <Link
      href={`/flight/${flight.id}`}
      prefetch
      className={cn(
        "relative block rounded-2xl border bg-background shadow-sm transition hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500",
        className
      )}
      aria-label={`Flight ${flight.flightNumber}`}
    >
      <div className="grid grid-cols-12 gap-x-6 gap-y-3 p-4 sm:p-6">
        {/* Left: Flight / Origin */}
        <div className="col-span-12 sm:col-span-3 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="text-base font-semibold shrink-0">
              {flight.airline}{flight.flightNumber}
            </div>
            {flight.passengerName && (
              <div className="text-sm text-muted-foreground truncate">
                {flight.passengerName}
              </div>
            )}
          </div>
          <div className="mt-1 text-2xl font-bold leading-tight">
            {flight.originIata || "—"}
          </div>
            <div className="text-sm text-muted-foreground truncate">{originCity || ""}</div>
            <div className="text-xs text-muted-foreground">
              {formatTime(flight.latestSchedDep)}
            </div>
        </div>

        {/* Middle: Route + Progress */}
        <div className="col-span-12 sm:col-span-6 flex flex-col items-center justify-center min-w-0">
          <div className="flex items-center gap-3 w-full max-w-md">
            <div className="flex-1 h-0.5 bg-muted rounded" />
            <Plane className="w-5 h-5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <div className="flex-1 h-0.5 bg-muted rounded" />
          </div>
          <div className="mt-2 w-full max-w-md min-w-0">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Progress</span>
              <span>{percent}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded overflow-hidden" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
          </div>
        </div>

        {/* Right: Destination */}
        <div className="col-span-12 sm:col-span-3 sm:text-right min-w-0">
          <div className="text-2xl font-bold leading-tight">
            {flight.destIata || "—"}
          </div>
          <div className="text-sm text-muted-foreground truncate">{destCity || ""}</div>
          <div className="text-xs text-muted-foreground">
            {formatTime(flight.latestSchedArr)}
          </div>
          <div className="mt-2 text-xs text-muted-foreground truncate">
            Dep: {flight.originTerminal || flight.terminal || "—"}
            <span className="mx-1">|</span>
            Arr: {flight.destTerminal || "—"}
          </div>
        </div>

        {/* Actions Row */}
        <div className="col-span-12 flex items-center justify-end gap-2 pt-2 flex-wrap min-w-0">
          <div className="shrink-0">
            <StatusBadge status={flight.latestStatus} />
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              type="button"
              className="p-2 rounded-lg hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-red-500"
              aria-label="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Provider Footer (kept outside action row so it wraps naturally) */}
        <div className="col-span-12 flex justify-end pt-1">
          <ProviderBadge provider="AeroDataBox" isActive />
        </div>
      </div>
      <span className="sr-only">Last updated {getLastUpdated()}</span>
    </Link>
  );
}
