import { FlightProvider, FlightProviderError } from "./flightProvider";
import { FlightStatusDTO, FlightQuery, FlightStatusCode } from "../types";
import { iataToIana } from "../airports";
import { formatInTimeZone } from "date-fns-tz";

type AviResponse<T> = {
  data?: T[];
  error?: { code: number; type: string; info: string };
};

type AviFlight = {
  airline?: { iata?: string };
  flight?: { number?: string };
  flight_date?: string; // YYYY-MM-DD
  flight_status?: string; // scheduled, active, landed, cancelled, etc
  departure?: {
    iata?: string;
    scheduled?: string | null; // ISO
    estimated?: string | null;
    actual?: string | null;
    terminal?: string | null;
    gate?: string | null;
  };
  arrival?: {
    iata?: string;
    scheduled?: string | null;
    estimated?: string | null;
    actual?: string | null;
    terminal?: string | null;
    gate?: string | null;
  };
  aircraft?: { iata?: string; registration?: string };
};

export class AviationstackProvider implements FlightProvider {
  // On Aviationstack Free tier, HTTPS is not supported. Use HTTP from the server.
  private baseUrl = "http://api.aviationstack.com/v1";
  private key: string | undefined;

  constructor(accessKey?: string) {
    this.key = accessKey || process.env.AVIATIONSTACK_ACCESS_KEY || undefined;
  }

  async getStatus(query: FlightQuery & { originIata?: string; destIata?: string }): Promise<FlightStatusDTO | null> {
    if (!this.key) throw new FlightProviderError("Missing AVIATIONSTACK_ACCESS_KEY");
    const params = new URLSearchParams({
      access_key: this.key,
      airline_iata: query.carrierIata,
      flight_number: query.flightNumber,
      flight_date: query.serviceDateISO,
      limit: "1",
    });
    // Optional hints
    if (query.originIata) params.set("dep_iata", query.originIata);
    if (query.destIata) params.set("arr_iata", query.destIata);

    const res = await this.fetchJson<AviFlight>(`/flights?${params.toString()}`);
    const flight = res[0];
    if (!flight) return null;

    const toISO = (s?: string | null) => (s ? new Date(s).toISOString() : undefined);
    const statusStr = (flight.flight_status || "").toUpperCase();
    const status = mapAviStatus(statusStr);

    return {
      schedDep: toISO(flight.departure?.scheduled || undefined),
      schedArr: toISO(flight.arrival?.scheduled || undefined),
      estDep: toISO(flight.departure?.estimated || undefined),
      estArr: toISO(flight.arrival?.estimated || undefined),
      actDep: toISO(flight.departure?.actual || undefined),
      actArr: toISO(flight.arrival?.actual || undefined),
      gateDep: flight.departure?.gate || undefined,
      gateArr: flight.arrival?.gate || undefined,
      terminalDep: flight.departure?.terminal || undefined,
      terminalArr: flight.arrival?.terminal || undefined,
      status,
      aircraftType: flight.aircraft?.iata || undefined,
      originIata: flight.departure?.iata || query.originIata,
      destIata: flight.arrival?.iata || query.destIata,
      delayReason: undefined,
    };
  }

  // Fetch future schedules by airport/date and direction. Returns raw flights.
  async fetchFutureSchedulesByAirport(params: { iataCode: string; date: string; type: "departure" | "arrival" }): Promise<AviFlight[]> {
    if (!this.key) throw new FlightProviderError("Missing AVIATIONSTACK_ACCESS_KEY");
    const qs = new URLSearchParams({ access_key: this.key, date: params.date });
    if (params.type === "departure") qs.set("iataCode", params.iataCode);
    // Try 'flightsFuture' endpoint first
    try {
      return await this.fetchJson<AviFlight>(`/flightsFuture?${qs.toString()}`);
    } catch (_e) {
      // Fallback to 'flight_schedules' or 'flights' with filters
    }
    // flight_schedules
    try {
      const qs2 = new URLSearchParams({ access_key: this.key, flight_date: params.date });
      if (params.type === "departure") qs2.set("dep_iata", params.iataCode); else qs2.set("arr_iata", params.iataCode);
      return await this.fetchJson<AviFlight>(`/flight_schedules?${qs2.toString()}`);
  } catch (_e) {
      // Fallback to flights with scheduled status
    }
    const qs3 = new URLSearchParams({ access_key: this.key, flight_date: params.date, flight_status: "scheduled" });
    if (params.type === "departure") qs3.set("dep_iata", params.iataCode); else qs3.set("arr_iata", params.iataCode);
    return await this.fetchJson<AviFlight>(`/flights?${qs3.toString()}`);
  }

  // Fetch a single flight schedule by carrier + number + date
  async fetchScheduleByFlight(params: { airline_iata: string; flight_number: string; flight_date: string }): Promise<AviFlight | null> {
    if (!this.key) throw new FlightProviderError("Missing AVIATIONSTACK_ACCESS_KEY");
    // Try flight_schedules first
    const qs1 = new URLSearchParams({
      access_key: this.key,
      airline_iata: params.airline_iata,
      flight_number: params.flight_number,
      flight_date: params.flight_date,
      limit: "1",
    });
    try {
      const r1 = await this.fetchJson<AviFlight>(`/flight_schedules?${qs1.toString()}`);
      if (r1[0]) return r1[0];
    } catch {}
    // Fallback to flights endpoint filtered by date and scheduled
    const qs2 = new URLSearchParams({
      access_key: this.key,
      airline_iata: params.airline_iata,
      flight_number: params.flight_number,
      flight_date: params.flight_date,
      flight_status: "scheduled",
      limit: "1",
    });
    try {
      const r2 = await this.fetchJson<AviFlight>(`/flights?${qs2.toString()}`);
      if (r2[0]) return r2[0];
    } catch {}
    return null;
  }

  // Fetch a single flight schedule by combined flight IATA code (e.g., DL295)
  async fetchScheduleByIataFlight(params: { flight_iata: string; flight_date: string }): Promise<AviFlight | null> {
    if (!this.key) throw new FlightProviderError("Missing AVIATIONSTACK_ACCESS_KEY");
    const qs1 = new URLSearchParams({ access_key: this.key, flight_iata: params.flight_iata, flight_date: params.flight_date, limit: "1" });
    try {
      const r1 = await this.fetchJson<AviFlight>(`/flight_schedules?${qs1.toString()}`);
      if (r1[0]) return r1[0];
    } catch {}
    const qs2 = new URLSearchParams({ access_key: this.key, flight_iata: params.flight_iata, flight_date: params.flight_date, flight_status: "scheduled", limit: "1" });
    try {
      const r2 = await this.fetchJson<AviFlight>(`/flights?${qs2.toString()}`);
      if (r2[0]) return r2[0];
    } catch {}
    return null;
  }

  private async fetchJson<T>(path: string): Promise<T[]> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url);
    if (!res.ok) throw new FlightProviderError(`HTTP ${res.status}`);
    const json = (await res.json()) as AviResponse<T>;
    if (json.error) throw new FlightProviderError(`${json.error.type}: ${json.error.info}`, json.error.code);
    return json.data || [];
  }
}

function mapAviStatus(s: string): FlightStatusCode {
  // aviationstack statuses: scheduled, active, landed, cancelled, incident, diverted
  switch (s) {
    case "SCHEDULED": return FlightStatusCode.SCHEDULED;
    case "ACTIVE": return FlightStatusCode.ENROUTE;
    case "LANDED": return FlightStatusCode.LANDED;
    case "CANCELLED": return FlightStatusCode.CANCELLED;
    case "DIVERTED": return FlightStatusCode.DIVERTED;
    default: return FlightStatusCode.UNKNOWN;
  }
}

// Helpers to compute serviceDate (origin local) from a scheduled departure timestamp
export function toServiceDateLocalUTC(iata?: string | null, schedISO?: string | null): Date | null {
  if (!schedISO) return null;
  try {
    const tz = iataToIana(iata);
    if (tz) {
      const ymd = formatInTimeZone(new Date(schedISO), tz, "yyyy-MM-dd");
      return new Date(`${ymd}T00:00:00Z`);
    }
    // Fallback: use date part of ISO (assumed local) and coerce to UTC midnight
    const d = new Date(schedISO);
    const y = d.getUTCFullYear();
    const m = d.getUTCMonth() + 1;
    const dd = d.getUTCDate();
    const ymd = `${y}-${String(m).padStart(2, "0")}-${String(dd).padStart(2, "0")}`;
    return new Date(`${ymd}T00:00:00Z`);
  } catch {
    return null;
  }
}
