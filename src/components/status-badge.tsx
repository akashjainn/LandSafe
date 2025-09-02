import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status?: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const statusMap: Record<string, { label: string; cls: string }> = {
    ON_TIME: { 
      label: 'On time', 
      cls: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20' 
    },
    DELAYED: { 
      label: 'Delayed', 
      cls: 'bg-amber-50 text-amber-700 ring-amber-600/20' 
    },
    CANCELLED: { 
      label: 'Cancelled', 
      cls: 'bg-rose-50 text-rose-700 ring-rose-600/20' 
    },
    EARLY: { 
      label: 'Early', 
      cls: 'bg-blue-50 text-blue-700 ring-blue-600/20' 
    },
    SCHEDULED: { 
      label: 'Scheduled', 
      cls: 'bg-slate-50 text-slate-700 ring-slate-600/20' 
    },
    UNKNOWN: { 
      label: 'Unknown', 
      cls: 'bg-slate-100 text-slate-700 ring-slate-400/20' 
    },
  };

  const statusInfo = statusMap[status?.toUpperCase() ?? 'UNKNOWN'] || statusMap.UNKNOWN;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        statusInfo.cls,
        className
      )}
    >
      {statusInfo.label}
    </span>
  );
}
