import { IATA_CITY_COUNTRY_EXPANDED } from '../../airport_mappings';

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
  FLL: "America/New_York",
  DAL: "America/Chicago",
  CHS: "America/New_York",
};

// Legacy mapping for backwards compatibility, but now using comprehensive database
export const IATA_CITY_COUNTRY: Record<string, string> = {
  ATL: "Atlanta, GA",
  JFK: "New York, NY", 
  LGA: "New York, NY",
  EWR: "Newark, NJ",
  BOS: "Boston, MA",
  DCA: "Washington, DC",
  IAD: "Washington, DC",
  MSP: "Minneapolis, MN",
  ORD: "Chicago, IL",
  DFW: "Dallas, TX",
  DEN: "Denver, CO",
  PHX: "Phoenix, AZ",
  LAX: "Los Angeles, CA",
  SFO: "San Francisco, CA",
  SEA: "Seattle, WA",
  AUS: "Austin, TX",
  HND: "Tokyo, Japan",
  NRT: "Tokyo, Japan",
  KIX: "Osaka, Japan",
  SYD: "Sydney, Australia",
  AKL: "Auckland, New Zealand",
  LHR: "London, UK",
  CDG: "Paris, France",
  FRA: "Frankfurt, Germany",
  MCO: "Orlando, FL",
  FLL: "Fort Lauderdale, FL",
  DAL: "Dallas, TX",
  CHS: "Charleston, SC",
};

export function iataToIana(iata?: string | null): string | undefined {
  return iata ? IATA_TZ[iata.toUpperCase()] : undefined;
}

export function iataToCity(iata?: string | null): string | undefined {
  if (!iata) return undefined;
  const upperIata = iata.toUpperCase();
  
  // First try the comprehensive database
  const expandedCity = IATA_CITY_COUNTRY_EXPANDED[upperIata];
  if (expandedCity) return expandedCity;
  
  // Fallback to legacy mapping for compatibility
  return IATA_CITY_COUNTRY[upperIata];
}

export function formatAirport(iata?: string | null): string {
  if (!iata) return "—";
  return iata;
}

export function formatAirportWithCity(iata?: string | null): { code: string; city?: string } {
  if (!iata) return { code: "—" };
  const city = iataToCity(iata);
  return { code: iata, city };
}