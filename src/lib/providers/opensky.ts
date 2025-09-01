import { FlightProvider, FlightProviderError } from "./flightProvider";
import { FlightStatusDTO, FlightQuery, FlightStatusCode } from "../types";

// Minimal airline IATA->ICAO map for callsign matching
const AIRLINE_IATA_TO_ICAO: Record<string, string> = {
  DL: "DAL", // Delta
  UA: "UAL", // United
  AA: "AAL", // American
  WN: "SWA", // Southwest
  AS: "ASA", // Alaska
  B6: "JBU", // JetBlue
  NK: "NKS", // Spirit
  F9: "FFT", // Frontier
  LH: "DLH", // Lufthansa
  BA: "BAW", // British Airways
  AF: "AFR", // Air France
  EK: "UAE", // Emirates
  SQ: "SIA", // Singapore
  AC: "ACA", // Air Canada
};

// Minimal airport IATA<->ICAO map for common airports
const AIRPORT_IATA_TO_ICAO: Record<string, string> = {
  ATL: "KATL",
  JFK: "KJFK",
  LGA: "KLGA",
  EWR: "KEWR",
  BOS: "KBOS",
  DCA: "KDCA",
  IAD: "KIAD",
  LAX: "KLAX",
  ORD: "KORD",
  DFW: "KDFW",
  HND: "RJTT",
  NRT: "RJAA",
};

const AIRPORT_ICAO_TO_IATA: Record<string, string> = Object.fromEntries(
  Object.entries(AIRPORT_IATA_TO_ICAO).map(([iata, icao]) => [icao, iata])
);

function normalizeCallsign(s?: string | null) {
  return (s || "").trim().replace(/\s+/g, "");
}

export class OpenSkyProvider implements FlightProvider {
  private username: string | undefined;
  private password: string | undefined;
  private baseUrl = "https://opensky-network.org/api";

  constructor(username?: string, password?: string) {
    // Prefer explicit args, then env, then undefined (fallback to synthetic)
    this.username = username || process.env.OPEN_SKY_USERNAME || undefined;
    this.password = password || process.env.OPEN_SKY_PASSWORD || undefined;
  }

  async getStatus(query: FlightQuery): Promise<FlightStatusDTO | null> {
    // If no auth, return synthetic but realistic data
    if (!this.username || !this.password) {
      return this.synthetic(query);
    }

    try {
      const { carrierIata, flightNumber, serviceDateISO, originIata, destIata } = query as FlightQuery & {
        originIata?: string;
        destIata?: string;
      };

      const begin = Math.floor(new Date(serviceDateISO).getTime() / 1000);
      const end = begin + 24 * 60 * 60;

      const icaoAirline = AIRLINE_IATA_TO_ICAO[carrierIata] || carrierIata;
      const needle1 = normalizeCallsign(`${carrierIata}${flightNumber}`);
      const needle2 = normalizeCallsign(`${icaoAirline}${Number(flightNumber)}`); // OpenSky often drops leading zero

      // Prefer arrival search if we have dest, else departure with origin
      const destIcao = destIata ? AIRPORT_IATA_TO_ICAO[destIata] : undefined;
      const originIcao = originIata ? AIRPORT_IATA_TO_ICAO[originIata] : undefined;

      type OpenSkyFlight = {
        callsign?: string | null;
        firstSeen?: number;
        lastSeen?: number;
        estDepartureAirport?: string | null;
        estArrivalAirport?: string | null;
      };
      const candidates: OpenSkyFlight[] = [];
      if (destIcao) {
        const arr = await this.fetchJson(`/flights/arrival?airport=${destIcao}&begin=${begin}&end=${end}`);
        if (Array.isArray(arr)) candidates.push(...arr);
      }
      if (originIcao) {
        const dep = await this.fetchJson(`/flights/departure?airport=${originIcao}&begin=${begin}&end=${end}`);
        if (Array.isArray(dep)) candidates.push(...dep);
      }

      // Filter by callsign match
      const matches = candidates.filter((f) => {
        const cs = normalizeCallsign(f.callsign);
        return cs === needle1 || cs === needle2 || cs.startsWith(needle1) || cs.startsWith(needle2);
      });

      const picked = matches[0] || candidates.find((f) => normalizeCallsign(f.callsign).includes(flightNumber));
      if (!picked) return this.synthetic(query);

      // Map OpenSky flight record to our DTO
      const actDepSec: number | undefined = picked.firstSeen;
      const actArrSec: number | undefined = picked.lastSeen;
      const depIcao: string | undefined = picked.estDepartureAirport || originIcao;
      const arrIcao: string | undefined = picked.estArrivalAirport || destIcao;

      let status: FlightStatusCode = FlightStatusCode.UNKNOWN;
      if (actArrSec) status = FlightStatusCode.LANDED;
      else if (actDepSec) status = FlightStatusCode.ENROUTE;

      const actDepISO = actDepSec ? new Date(actDepSec * 1000).toISOString() : undefined;
      const actArrISO = actArrSec ? new Date(actArrSec * 1000).toISOString() : undefined;

      return {
        // OpenSky doesn't provide scheduled/estimated; 
        // use actuals as estimated so UI shows times.
        schedDep: undefined,
        schedArr: undefined,
        estDep: actDepISO,
        estArr: actArrISO,
        actDep: actDepISO,
        actArr: actArrISO,
        gateDep: undefined,
        gateArr: undefined,
        terminalDep: undefined,
        terminalArr: undefined,
        status,
        aircraftType: undefined,
        originIata: depIcao ? AIRPORT_ICAO_TO_IATA[depIcao] : originIata,
        destIata: arrIcao ? AIRPORT_ICAO_TO_IATA[arrIcao] : destIata,
        delayReason: undefined,
      };
    } catch (error) {
      console.error("OpenSkyProvider error:", error);
      throw new FlightProviderError(
        `OpenSky API error: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private async fetchJson(path: string) {
    const url = `${this.baseUrl}${path}`;
    const auth = Buffer.from(`${this.username}:${this.password}`).toString("base64");
    const res = await fetch(url, {
      headers: {
        Authorization: `Basic ${auth}`,
      },
    });
    if (!res.ok) {
      throw new FlightProviderError(`HTTP ${res.status} ${res.statusText}`, res.status);
    }
    return res.json();
  }

  private synthetic(query: FlightQuery): FlightStatusDTO {
    // Reuse similar logic as AeroData synthetic
    const baseTime = new Date(query.serviceDateISO);
    const flightNum = parseInt(query.flightNumber);
    let status: FlightStatusCode = FlightStatusCode.SCHEDULED;
    let delayMinutes = 0;
    if (Number.isFinite(flightNum)) {
      if (flightNum % 5 === 0) {
        status = FlightStatusCode.DELAYED; delayMinutes = 30;
      } else if (flightNum % 7 === 0) {
        status = FlightStatusCode.CANCELLED;
      } else if (flightNum % 3 === 0) {
        status = FlightStatusCode.BOARDING;
      } else if (flightNum % 2 === 0) {
        status = FlightStatusCode.ENROUTE;
      }
    }
    const schedDep = new Date(baseTime.getTime() + 14 * 60 * 60 * 1000);
    const schedArr = new Date(baseTime.getTime() + 17 * 60 * 60 * 1000);
    const estDep = new Date(schedDep.getTime() + delayMinutes * 60 * 1000);
    const estArr = new Date(schedArr.getTime() + delayMinutes * 60 * 1000);
    return {
      schedDep: schedDep.toISOString(),
      schedArr: schedArr.toISOString(),
      estDep: status !== FlightStatusCode.CANCELLED ? estDep.toISOString() : undefined,
      estArr: status !== FlightStatusCode.CANCELLED ? estArr.toISOString() : undefined,
      actDep: undefined,
      actArr: undefined,
      gateDep: undefined,
      gateArr: undefined,
      terminalDep: undefined,
      terminalArr: undefined,
      status,
      aircraftType: undefined,
      originIata: undefined,
      destIata: undefined,
      delayReason: undefined,
    };
  }
}
