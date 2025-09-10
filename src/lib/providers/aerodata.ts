import { FlightProvider, FlightProviderError } from "./flightProvider";
import { FlightStatusDTO, FlightQuery, FlightStatusCode } from "../types";
import { normalizeAirlineCode } from "../airlineCodes";
import { iataToIana } from "../airports";

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
  const baseUrl = `${isApiMarket ? this.apiMarketBase : this.rapidBase}/number/${flightId}`;
  const url = `${baseUrl}/${serviceDateISO}?dateLocalRole=Both`;

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

      // Fallback for codeshares: same number/date (+ airports if given) regardless of airline
      const codeShareFallback = !candidates.length
        ? list.filter((r) => {
            const depLocal = this.getLocalDepDate(r);
            const dateMatches = depLocal ? depLocal === depDateLocal : true;
            const origMatches = !orig || r?.departure?.airport?.iata?.toUpperCase() === orig || r?.departure?.iata?.toUpperCase() === orig;
            const destMatches = !dest || r?.arrival?.airport?.iata?.toUpperCase() === dest || r?.arrival?.iata?.toUpperCase() === dest;
            const numberMatches = (r?.flight?.number || "").replace(/\D/g, "") === query.flightNumber.replace(/\D/g, "");
            return numberMatches && dateMatches && origMatches && destMatches;
          })
        : [];

  const pool = candidates.length ? candidates : (codeShareFallback.length ? codeShareFallback : list);

      const best = pool
        .sort((a, b) => new Date(this.pickUtcTime(a?.departure)).getTime() - new Date(this.pickUtcTime(b?.departure)).getTime())[0];

      if (!best) {
        // Fallback attempt 1: try a likely operating carrier alias (e.g., SK -> NK)
        const fallbackCarrierMap: Record<string, string> = { SK: 'NK' };
        const alt = fallbackCarrierMap[carrier];
        if (alt) {
          const altFlightId = `${alt}${query.flightNumber}`;
          const altUrl = `${baseUrl.replace(carrier + query.flightNumber, altFlightId)}/${serviceDateISO}?dateLocalRole=Both`;
          const altResp = await fetch(altUrl, { headers });
          if (altResp.ok) {
            const altData: AeroDataBoxFlight | AeroDataBoxFlight[] = await altResp.json();
            const altList: AeroDataBoxFlight[] = Array.isArray(altData) ? altData : [altData];
            const altPool = altList
              .filter((r) => {
                const depLocal = this.getLocalDepDate(r);
                const dateMatches = depLocal ? depLocal === depDateLocal : true;
                const origMatches = !orig || r?.departure?.airport?.iata?.toUpperCase() === orig || r?.departure?.iata?.toUpperCase() === orig;
                const destMatches = !dest || r?.arrival?.airport?.iata?.toUpperCase() === dest || r?.arrival?.iata?.toUpperCase() === dest;
                const numberMatches = (r?.flight?.number || "").replace(/\D/g, "") === query.flightNumber.replace(/\D/g, "");
                return dateMatches && origMatches && destMatches && numberMatches;
              });
            const altBest = (altPool.length ? altPool : altList)
              .sort((a, b) => new Date(this.pickUtcTime(a?.departure)).getTime() - new Date(this.pickUtcTime(b?.departure)).getTime())[0];
            if (altBest) return this.mapAeroDataResponse(altBest);
          }
        }
        // Fallback attempt 2: try adjacent dates to handle TZ boundaries (prev/next day)
        const shiftDate = (iso: string, deltaDays: number) => {
          const d = new Date(`${iso}T00:00:00Z`);
          d.setUTCDate(d.getUTCDate() + deltaDays);
          return d.toISOString().split('T')[0];
        };
        const adjDates = [shiftDate(serviceDateISO, -1), shiftDate(serviceDateISO, 1)];
        for (const adj of adjDates) {
          const adjUrl = `${baseUrl}/${adj}?dateLocalRole=Both`;
          const adjResp = await fetch(adjUrl, { headers });
          if (!adjResp.ok) continue;
          const adjData: AeroDataBoxFlight | AeroDataBoxFlight[] = await adjResp.json();
          const adjList: AeroDataBoxFlight[] = Array.isArray(adjData) ? adjData : [adjData];
          const adjCandidates = adjList.filter((r) => {
            const airlineMatches = r?.airline?.iata?.toUpperCase() === carrier;
            const origMatches = !orig || r?.departure?.airport?.iata?.toUpperCase() === orig || r?.departure?.iata?.toUpperCase() === orig;
            const destMatches = !dest || r?.arrival?.airport?.iata?.toUpperCase() === dest || r?.arrival?.iata?.toUpperCase() === dest;
            const numberMatches = (r?.flight?.number || "").replace(/\D/g, "") === query.flightNumber.replace(/\D/g, "");
            return airlineMatches && origMatches && destMatches && numberMatches;
          });
          const adjPool = adjCandidates.length ? adjCandidates : adjList.filter((r) => {
            const origMatches = !orig || r?.departure?.airport?.iata?.toUpperCase() === orig || r?.departure?.iata?.toUpperCase() === orig;
            const destMatches = !dest || r?.arrival?.airport?.iata?.toUpperCase() === dest || r?.arrival?.iata?.toUpperCase() === dest;
            const numberMatches = (r?.flight?.number || "").replace(/\D/g, "") === query.flightNumber.replace(/\D/g, "");
            return origMatches && destMatches && numberMatches;
          });
          const adjBest = (adjPool.length ? adjPool : adjList)
            .sort((a, b) => new Date(this.pickUtcTime(a?.departure)).getTime() - new Date(this.pickUtcTime(b?.departure)).getTime())[0];
          if (adjBest) return this.mapAeroDataResponse(adjBest);
        }
        return null;
      }
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
    const depIata = flight.departure?.airport?.iata || flight.departure?.iata;
    const arrIata = flight.arrival?.airport?.iata || flight.arrival?.iata;

    // AeroDataBox uses *TimeUtc/*TimeLocal fields
    const depSched = flight.departure?.scheduledTimeUtc
      || this.toUtcIso(flight.departure?.scheduledTimeLocal, depIata)
      || flight.departure?.scheduled
      || flight.departure?.scheduledTime?.utc;
    const arrSched = flight.arrival?.scheduledTimeUtc
      || this.toUtcIso(flight.arrival?.scheduledTimeLocal, arrIata)
      || flight.arrival?.scheduled
      || flight.arrival?.scheduledTime?.utc;
    const depEst = flight.departure?.estimatedTimeUtc
      || this.toUtcIso(flight.departure?.estimatedTimeLocal, depIata)
      || flight.departure?.estimated
      || flight.departure?.estimatedTime?.utc;
    const arrEst = flight.arrival?.estimatedTimeUtc
      || this.toUtcIso(flight.arrival?.estimatedTimeLocal, arrIata)
      || flight.arrival?.estimated
      || flight.arrival?.estimatedTime?.utc;
    const depAct = flight.departure?.actualTimeUtc
      || this.toUtcIso(flight.departure?.actualTimeLocal, depIata)
      || flight.departure?.actual
      || flight.departure?.actualTime?.utc;
    const arrAct = flight.arrival?.actualTimeUtc
      || this.toUtcIso(flight.arrival?.actualTimeLocal, arrIata)
      || flight.arrival?.actual
      || flight.arrival?.actualTime?.utc;

    const mapped: FlightStatusDTO = {
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
      originIata: depIata,
      destIata: arrIata,
      delayReason: flight.departure?.delay?.reasonCode,
    };

    // Fallback: derive status if provider string didn't map
    if (!mapped.status || mapped.status === FlightStatusCode.UNKNOWN) {
      if (mapped.actArr) mapped.status = FlightStatusCode.LANDED;
      else if (mapped.actDep && (mapped.estArr || mapped.schedArr)) mapped.status = FlightStatusCode.ENROUTE;
      else if (mapped.estDep || mapped.schedDep) mapped.status = FlightStatusCode.SCHEDULED;
    }

    return mapped;
  }

  private mapStatus(apiStatus: string): FlightStatusCode {
    // Map AeroDataBox status to our enum
    const key = (apiStatus || "").trim();
    const statusMap: Record<string, FlightStatusCode> = {
      "Scheduled": FlightStatusCode.SCHEDULED,
      "On time": FlightStatusCode.SCHEDULED,
      "Active": FlightStatusCode.ENROUTE,
      "En Route": FlightStatusCode.ENROUTE,
      "Departed": FlightStatusCode.DEPARTED,
      "Arrived": FlightStatusCode.LANDED,
      "Landed": FlightStatusCode.LANDED,
      "Delayed": FlightStatusCode.DELAYED,
      "Boarding": FlightStatusCode.BOARDING,
      "Cancelled": FlightStatusCode.CANCELLED,
      "Diverted": FlightStatusCode.DIVERTED,
    };

    return statusMap[key] || FlightStatusCode.UNKNOWN;
  }

  // no synthetic fallback

  private toUtcIso(local?: string, iata?: string): string | undefined {
    if (!local || !iata) return undefined;
    const tz = iataToIana(iata);
    if (!tz) return undefined;
    try {
      // Normalize to ISO-like string for parsing
      let s = local.replace(' ', 'T');
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s)) s += ':00';
      // Build a UTC date from local time in the given timezone using Intl
      const parts = s.split(/[T:.-]/).map(Number);
      const [y, m, d, hh, mm, ss = 0] = parts;
  // Compute the timezone offset at that local time by formatting and parsing the GMT offset
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        timeZoneName: 'shortOffset',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
      });
      // Format a Date constructed from the local wall time
      const wall = new Date(y, (m - 1), d, hh, mm, ss);
      const offsetMatch = fmt.formatToParts(wall).find(p => p.type === 'timeZoneName')?.value || 'GMT+00:00';
      const sign = /-/i.test(offsetMatch) ? -1 : 1;
      const om = offsetMatch.match(/GMT([+-])(\d{2}):(\d{2})/);
      const oh = om ? Number(om[2]) : 0;
      const oi = om ? Number(om[3]) : 0;
      const offsetMs = sign * (oh * 60 + oi) * 60 * 1000;
      // Convert local wall time to UTC by subtracting offset
      const utcMs = wall.getTime() - offsetMs;
      return new Date(utcMs).toISOString();
    } catch {
      return undefined;
    }
  }
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
