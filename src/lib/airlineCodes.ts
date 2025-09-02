const ICAO_TO_IATA: Record<string, string> = {
  // North America
  SWA: "WN", UAL: "UA", AAL: "AA", DAL: "DL", ASA: "AS", JBU: "B6", NKS: "NK", FFT: "F9",
  WJA: "WS", ACA: "AC",

  // Europe
  BAW: "BA", AFR: "AF", DLH: "LH", RYR: "FR", SWR: "LX", SAS: "SK", VIR: "VS", VLG: "VY", AUA: "OS",

  // Middle East
  UAE: "EK", ETD: "EY", THY: "TK", QTR: "QR",

  // Asia
  JAL: "JL", KAL: "KE", KLM: "KL", SIA: "SQ", CPA: "CX", CCA: "CA", CSN: "CZ", CES: "MU", EVA: "BR",
  ITY: "AZ",

  // Oceania
  ANZ: "NZ",

  // Latin America
  GLO: "G3", AVA: "AV", LPE: "LA", LAN: "LA",

  // Africa
  ETH: "ET",

  // Others
  EIN: "EI", IBE: "IB", PAL: "PR", THT: "TN", AEA: "UX", EZY: "U2", WZZ: "W6", IGO: "6E", VTI: "UK", HVN: "VN", SVA: "SV",
};

export function normalizeAirlineCode(input: string) {
  const code = input.trim().toUpperCase();
  if (code === "SW") return "WN"; // common user shorthand for Southwest
  if (code.length === 3 && ICAO_TO_IATA[code]) return ICAO_TO_IATA[code];
  return code; // assume it's already IATA (2-letter)
}

export function displayFlightIata(airlineIata: string, flightNumber: string) {
  const code = normalizeAirlineCode(airlineIata);
  const num = String(flightNumber).replace(/\D/g, "");
  return `${code}${num.padStart(4, "0")}`;
}

export function safeGate(g?: string) {
  return g?.trim() || "—";
}