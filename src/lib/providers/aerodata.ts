import { FlightProvider, FlightProviderError } from "./flightProvider";
import { FlightStatusDTO, FlightQuery, FlightStatusCode } from "../types";
import { normalizeAirlineCode } from "../airlineCodes";

export class AeroDataProvider implements FlightProvider {
  private apiMarketKey: string;
  private rapidKey: string;
  private apiMarketBase = "https://prod.api.market/api/v1/aedbx/aerodatabox/flights";
  private rapidBase = "https://aerodatabox.p.rapidapi.com/flights";

  constructor(apiKey?: string) {
  // apiKey param used as RapidAPI key fallback; API.Market uses its own env
  this.apiMarketKey = process.env.API_MARKET_KEY || "";
  this.rapidKey = apiKey || process.env.AERODATA_API_KEY || process.env.AERODATABOX_API_KEY || "";
  }

  async getStatus(query: FlightQuery): Promise<FlightStatusDTO | null> {
  // If no API key for either provider, don't fabricate data
  if (!this.apiMarketKey && (!this.rapidKey || this.rapidKey === "your_aerodata_api_key_here")) return null;

    try {
  const carrier = normalizeAirlineCode(query.carrierIata);
  const flightId = `${carrier}${query.flightNumber}`;
  const serviceDateISO = query.serviceDateISO; // should be origin-local date
      
      // Prefer API.Market if configured, else fallback to RapidAPI
      const isApiMarket = !!this.apiMarketKey;
      const url = `${isApiMarket ? this.apiMarketBase : this.rapidBase}/number/${flightId}/${serviceDateISO}`;

      const headers = isApiMarket
        ? {
            "x-api-market-key": this.apiMarketKey,
            "Accept": "application/json",
          }
        : {
            "X-RapidAPI-Key": this.rapidKey,
            "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
          } as Record<string, string>;

      const response = await fetch(url, { headers });

      if (!response.ok) {
        throw new FlightProviderError(
          `AeroDataBox API error: ${response.statusText}`,
          response.status
        );
      }

  const data: AeroDataBoxFlight | AeroDataBoxFlight[] = await response.json();

      // Tight selection: ensure airline/date match; filter by airports if provided
  const list: AeroDataBoxFlight[] = Array.isArray(data) ? data : [data];
      const depDateLocal = serviceDateISO;
      const orig = query.originIata?.toUpperCase();
      const dest = query.destIata?.toUpperCase();

      const candidates = list.filter((r) => {
        const airlineMatches = r?.airline?.iata?.toUpperCase() === carrier;
        const depLocal = this.getLocalDepDate(r);
        const dateMatches = depLocal ? depLocal === depDateLocal : true; // if missing, don't exclude
        const origMatches = !orig || r?.departure?.airport?.iata?.toUpperCase() === orig || r?.departure?.iata?.toUpperCase() === orig;
        const destMatches = !dest || r?.arrival?.airport?.iata?.toUpperCase() === dest || r?.arrival?.iata?.toUpperCase() === dest;
        return airlineMatches && dateMatches && origMatches && destMatches;
      });

      const best = (candidates.length ? candidates : list)
        .sort((a, b) => new Date(this.pickUtcTime(a?.departure)).getTime() - new Date(this.pickUtcTime(b?.departure)).getTime())[0];

      if (!best) return null;
  return this.mapAeroDataResponse(best);
    } catch (error) {
      console.error("AeroDataProvider error:", error);
      return null;
    }
  }

  // Prefer a UTC time string available on the leg for sorting and mapping
  private pickUtcTime(leg?: AeroDataBoxLeg): string {
    if (!leg) return "1970-01-01T00:00:00Z";
    const scheduledFallback = typeof leg.scheduled === 'string' ? leg.scheduled : undefined;
    const scheduledObjUtc = typeof leg.scheduledTime === 'object' ? leg.scheduledTime?.utc : undefined;
    return (
      leg.scheduledTimeUtc ||
      leg.estimatedTimeUtc ||
      leg.actualTimeUtc ||
      scheduledFallback ||
      scheduledObjUtc ||
      "1970-01-01T00:00:00Z"
    );
  }

  private getLocalDepDate(r: AeroDataBoxFlight): string | undefined {
    const local = r?.departure?.scheduledTimeLocal;
    if (local && /^\d{4}-\d{2}-\d{2}/.test(local)) return local.slice(0, 10);
    const utc = r?.departure?.scheduledTimeUtc;
    if (utc) {
      try { return new Date(utc).toISOString().split('T')[0]; } catch {}
    }
    return undefined;
  }

  // Use a more specific type for AeroDataBox API response
  private mapAeroDataResponse(data: AeroDataBoxFlight): FlightStatusDTO {
    const flight = data;

    // AeroDataBox uses *TimeUtc/*TimeLocal fields
  const depSched = flight.departure?.scheduledTimeUtc || flight.departure?.scheduled || flight.departure?.scheduledTime?.utc;
  const arrSched = flight.arrival?.scheduledTimeUtc || flight.arrival?.scheduled || flight.arrival?.scheduledTime?.utc;
  const depEst = flight.departure?.estimatedTimeUtc || flight.departure?.estimated || flight.departure?.estimatedTime?.utc;
  const arrEst = flight.arrival?.estimatedTimeUtc || flight.arrival?.estimated || flight.arrival?.estimatedTime?.utc;
  const depAct = flight.departure?.actualTimeUtc || flight.departure?.actual || flight.departure?.actualTime?.utc;
  const arrAct = flight.arrival?.actualTimeUtc || flight.arrival?.actual || flight.arrival?.actualTime?.utc;

    return {
      schedDep: depSched,
      schedArr: arrSched,
      estDep: depEst,
      estArr: arrEst,
      actDep: depAct,
      actArr: arrAct,
      gateDep: flight.departure?.gate || undefined,
      gateArr: flight.arrival?.gate || undefined,
      terminalDep: flight.departure?.terminal,
      terminalArr: flight.arrival?.terminal,
      status: this.mapStatus(flight.status ?? ""),
      aircraftType: flight.aircraft?.model,
      originIata: flight.departure?.airport?.iata || flight.departure?.iata,
      destIata: flight.arrival?.airport?.iata || flight.arrival?.iata,
      delayReason: flight.departure?.delay?.reasonCode,
    };
  }

  private mapStatus(apiStatus: string): FlightStatusCode {
    // Map AeroDataBox status to our enum
    const statusMap: Record<string, FlightStatusCode> = {
      "Scheduled": FlightStatusCode.SCHEDULED,
      "Active": FlightStatusCode.ENROUTE,
      "Landed": FlightStatusCode.LANDED,
      "Cancelled": FlightStatusCode.CANCELLED,
      "Diverted": FlightStatusCode.DIVERTED,
    };

    return statusMap[apiStatus] || FlightStatusCode.UNKNOWN;
  }

  // no synthetic fallback
}

// Minimal type for AeroDataBox flight objects used here
type AeroDataBoxLeg = {
  // Common Aerodatabox shapes
  scheduledTimeUtc?: string;
  estimatedTimeUtc?: string;
  actualTimeUtc?: string;
  scheduledTimeLocal?: string;
  estimatedTimeLocal?: string;
  actualTimeLocal?: string;
  // Fallbacks from older shapes seen in examples
  scheduled?: string;
  estimated?: string;
  actual?: string;
  scheduledTime?: { utc?: string };
  estimatedTime?: { utc?: string };
  actualTime?: { utc?: string };
  gate?: string;
  terminal?: string;
  airport?: { iata?: string };
  iata?: string;
  delay?: { reasonCode?: string };
};
type AeroDataBoxFlight = {
  flight_date?: string;
  status?: string;
  airline?: { iata?: string; icao?: string };
  flight?: { iata?: string; icao?: string; number?: string };
  departure?: AeroDataBoxLeg;
  arrival?: AeroDataBoxLeg;
  aircraft?: { model?: string };
};
