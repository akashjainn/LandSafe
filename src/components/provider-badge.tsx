import { cn } from "@/lib/utils";

interface ProviderBadgeProps {
  provider?: string;
  isActive?: boolean;
  className?: string;
}

export function ProviderBadge({ provider = "Unknown", isActive = true, className }: ProviderBadgeProps) {
  const providerMap: Record<string, string> = {
    AERODATABOX: "AeroDataBox",
    AVIATIONSTACK: "AviationStack", 
    OPENSKY: "OpenSky",
    RAPIDAPI: "RapidAPI",
    "API.MARKET": "API.Market",
  };

  const displayName = providerMap[provider?.toUpperCase()] || provider;
  
  return (
    <span 
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset",
        isActive 
          ? "bg-blue-50 text-blue-700 ring-blue-600/20" 
          : "bg-gray-50 text-gray-600 ring-gray-500/20",
        className
      )}
    >
      {displayName}
      {isActive && (
        <span className="ml-1 h-1.5 w-1.5 rounded-full bg-blue-600"></span>
      )}
    </span>
  );
}
