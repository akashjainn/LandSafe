import { format, formatDistanceToNow } from "date-fns";
import { ArrowRight, Clock, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/status-badge";
import { ProviderBadge } from "@/components/provider-badge";
import { Card } from "@/components/ui/card";

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

  return (
    <Card className={cn(
      "p-4 hover:shadow-md transition-shadow cursor-pointer",
      className
    )}>
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
  );
}
