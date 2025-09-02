import { FlightProvider, FlightProviderError } from "./flightProvider";
import { FlightStatusDTO, FlightQuery, FlightStatusCode } from "../types";
import { normalizeAirlineCode } from "../airlineCodes";

export class AeroDataProvider implements FlightProvider {
  private apiKey: string;
  private baseUrl = "https://aerodatabox.p.rapidapi.com/flights";

  constructor(apiKey?: string) {
  this.apiKey = apiKey || process.env.AERODATA_API_KEY || process.env.AERODATABOX_API_KEY || "";
  }

  async getStatus(query: FlightQuery): Promise<FlightStatusDTO | null> {
    // If no API key, don't fabricate data
    if (!this.apiKey || this.apiKey === "your_aerodata_api_key_here") {
      return null;
    }

    try {
  const carrier = normalizeAirlineCode(query.carrierIata);
  const flightId = `${carrier}${query.flightNumber}`;
  const serviceDateISO = query.serviceDateISO; // should be origin-local date
      
      // AeroDataBox API endpoint format
      const url = `${this.baseUrl}/number/${flightId}/${serviceDateISO}`;
      
      const response = await fetch(url, {
        headers: {
          "X-RapidAPI-Key": this.apiKey,
          "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
        },
      });

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

      const candidates = list.filter((r) =>
        r?.airline?.iata?.toUpperCase() === carrier && r?.flight_date === depDateLocal &&
        (!orig || r?.departure?.airport?.iata?.toUpperCase() === orig || r?.departure?.iata?.toUpperCase() === orig) &&
        (!dest || r?.arrival?.airport?.iata?.toUpperCase() === dest || r?.arrival?.iata?.toUpperCase() === dest)
      );

      const best = (candidates.length ? candidates : list)
        .sort((a, b) => new Date(a?.departure?.scheduled || 0).getTime() - new Date(b?.departure?.scheduled || 0).getTime())[0];

      if (!best) return null;
  return this.mapAeroDataResponse(best);
    } catch (error) {
      console.error("AeroDataProvider error:", error);
      return null;
    }
  }

  // Use a more specific type for AeroDataBox API response
  private mapAeroDataResponse(data: AeroDataBoxFlight): FlightStatusDTO {
    const flight = data;

    // Prefer top-level fields if present; otherwise nested .utc
    const depSched = flight.departure?.scheduled || flight.departure?.scheduledTime?.utc;
    const arrSched = flight.arrival?.scheduled || flight.arrival?.scheduledTime?.utc;
    const depEst = flight.departure?.estimated || flight.departure?.estimatedTime?.utc;
    const arrEst = flight.arrival?.estimated || flight.arrival?.estimatedTime?.utc;
    const depAct = flight.departure?.actual || flight.departure?.actualTime?.utc;
    const arrAct = flight.arrival?.actual || flight.arrival?.actualTime?.utc;

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
type AeroDataBoxTime = { utc?: string } | string | undefined;
type AeroDataBoxAirport = { iata?: string } | undefined;
type AeroDataBoxLeg = {
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
