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
  MCO: "America/New_York",
};

export const IATA_CITY_COUNTRY: Record<string, string> = {
  ATL: "Atlanta, USA",
  JFK: "New York, USA", 
  LGA: "New York, USA",
  EWR: "Newark, USA",
  BOS: "Boston, USA",
  DCA: "Washington, USA",
  IAD: "Washington, USA",
  MSP: "Minneapolis, USA",
  ORD: "Chicago, USA",
  DFW: "Dallas, USA",
  DEN: "Denver, USA",
  PHX: "Phoenix, USA",
  LAX: "Los Angeles, USA",
  SFO: "San Francisco, USA",
  SEA: "Seattle, USA",
  AUS: "Austin, USA",
  HND: "Tokyo, Japan",
  NRT: "Tokyo, Japan",
  KIX: "Osaka, Japan",
  SYD: "Sydney, Australia",
  AKL: "Auckland, New Zealand",
  LHR: "London, UK",
  CDG: "Paris, France",
  FRA: "Frankfurt, Germany",
  MCO: "Orlando, USA",
};

export function iataToIana(iata?: string | null): string | undefined {
  return iata ? IATA_TZ[iata.toUpperCase()] : undefined;
}

export function iataToCity(iata?: string | null): string | undefined {
  return iata ? IATA_CITY_COUNTRY[iata.toUpperCase()] : undefined;
}

export function formatAirport(iata?: string | null): string {
  if (!iata) return "—";
  const city = iataToCity(iata);
  return city ? `${iata} (${city})` : iata;
}