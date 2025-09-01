export const IATA_TZ: Record<string, string> = {
  ATL: "America/New_York",
  JFK: "America/New_York",
  LGA: "America/New_York",
  EWR: "America/New_York",
  BOS: "America/New_York",
  DCA: "America/New_York",
  IAD: "America/New_York",
  MSP: "America/Chicago",
  ORD: "America/Chicago",
  DFW: "America/Chicago",
  DEN: "America/Denver",
  PHX: "America/Phoenix",
  LAX: "America/Los_Angeles",
  SFO: "America/Los_Angeles",
  SEA: "America/Los_Angeles",
  AUS: "America/Chicago",
  HND: "Asia/Tokyo",
  NRT: "Asia/Tokyo",
  KIX: "Asia/Tokyo",
  SYD: "Australia/Sydney",
  AKL: "Pacific/Auckland",
  LHR: "Europe/London",
  CDG: "Europe/Paris",
  FRA: "Europe/Berlin",
};

export function iataToIana(iata?: string | null): string | undefined {
  return iata ? IATA_TZ[iata.toUpperCase()] : undefined;
}