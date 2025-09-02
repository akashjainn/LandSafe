import { normalizeAirlineCode } from "./airlineCodes";

// Minimal, extensible callsign-to-IATA lookup for common airlines
const CALLSIGN_TO_IATA: Record<string, string> = {
  // normalize keys: lowercase, no spaces
  american: "AA",
  aircanada: "AC",
  canada: "AC",
  azul: "AD",
  airfrance: "AF",
  france: "AF",
  airindia: "AI",
  india: "AI",
  alaska: "AS",
  avianca: "AV",
  ita: "AZ",
  italia: "AZ",
  alitalia: "AZ",
  british: "BA",
  speedbird: "BA",
  jetblue: "B6",
  jetbluee: "B6", // typo guard
  "jet blue": "B6",
  eva: "BR",
  airchina: "CA",
  china: "CA",
  cathay: "CX",
  cathaypacific: "CX",
  chinasouthern: "CZ",
  southern: "CZ",
  delta: "DL",
  emirates: "EK",
  aerlingus: "EI",
  lingus: "EI",
  ethiopian: "ET",
  etihad: "EY",
  frontier: "F9",
  ryanair: "FR",
  gol: "G3",
  hawaiian: "HA",
  iberia: "IB",
  jal: "JL",
  japanairlines: "JL",
  korean: "KE",
  koreanair: "KE",
  klm: "KL",
  latam: "LA",
  lan: "LA",
  lufthansa: "LH",
  swiss: "LX",
  chinaeastern: "MU",
  eastern: "MU",
  spirit: "NK",
  airnewzealand: "NZ",
  newzealand: "NZ",
  austrian: "OS",
  philippine: "PR",
  pal: "PR",
  qatar: "QR",
  qantas: "QF",
  sas: "SK",
  scandinavian: "SK",
  singapore: "SQ",
  turkish: "TK",
  airtahitinui: "TN",
  tahiti: "TN",
  united: "UA",
  aireuropa: "UX",
  europa: "UX",
  virgin: "VS",
  virginatlantic: "VS",
  vueling: "VY",
  southwest: "WN",
  westjet: "WS",
  easyjet: "U2",
  "easy jet": "U2",
  wizz: "W6",
  wizzair: "W6",
  indigo: "6E",
  "indi go": "6E",
  vistara: "UK",
  vietnam: "VN",
  saudia: "SV",
  saudi: "SV",
};

export type NormalizedFlight = {
  carrierIata: string;
  flightNumber: string; // keep digits, preserve leading zeros from input
};

// Accepts IATA/ICAO prefixes, callsign words, spaces, dashes, and leading zeros
export function normalizeFlight(input: string): NormalizedFlight | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const upper = raw.toUpperCase();

  // 1) Callsign words + number (e.g., "Speedbird 287", "Emirates-201")
  const wordNum = upper.match(/^([A-Z ]+)[\s-]*(\d{1,4})([A-Z]?)$/);
  if (wordNum) {
    const wordKey = wordNum[1].replace(/\s+/g, '').toLowerCase();
    const iata = CALLSIGN_TO_IATA[wordKey];
    if (iata) {
      return { carrierIata: iata, flightNumber: wordNum[2] };
    }
  }

  // 2) Code (IATA or ICAO) + number, tolerate space/dash in between
  const codeNum = upper.replace(/\s+/g, '').replace(/-/g, '').match(/^([A-Z0-9]{2,3})(\d{1,4})([A-Z]?)$/);
  if (codeNum) {
    const code = codeNum[1];
    const num = codeNum[2];
    // 3-letter = ICAO, normalize to IATA; otherwise assume already IATA
    const iata = code.length === 3 ? normalizeAirlineCode(code) : code;
    if (iata && /^[A-Z0-9]{2}$/.test(iata)) {
      return { carrierIata: iata, flightNumber: num };
    }
  }

  return null;
}

export function formatDisplay(iata: string, number: string, pad: 3 | 4 = 3) {
  const n = number.replace(/\D/g, '');
  const padded = n.padStart(pad, '0');
  return `${normalizeAirlineCode(iata)}${padded}`;
}
