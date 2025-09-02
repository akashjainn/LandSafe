const ICAO_TO_IATA: Record<string, string> = {
  SWA: "WN",
  DAL: "DL",
  AAL: "AA",
  UAL: "UA",
  ASA: "AS",
  JBU: "B6",
  NKS: "NK",
  FFT: "F9",
  BAW: "BA",
  AFR: "AF",
  DLH: "LH",
  UAE: "EK",
  SIA: "SQ",
  ACA: "AC",
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