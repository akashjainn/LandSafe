// Define the enum here since Prisma may not export it properly
export enum FlightStatusCode {
  SCHEDULED = "SCHEDULED",
  BOARDING = "BOARDING", 
  DEPARTED = "DEPARTED",
  ENROUTE = "ENROUTE",
  DIVERTED = "DIVERTED",
  CANCELLED = "CANCELLED",
  LANDED = "LANDED",
  DELAYED = "DELAYED",
  UNKNOWN = "UNKNOWN"
}

// Basic types based on our Prisma schema
export type Flight = {
  id: string;
  carrierIata: string;
  flightNumber: string;
  serviceDate: Date;
  originIata?: string | null;
  destIata?: string | null;
  createdAt: Date;
  createdBy?: string | null;
  notes?: string | null;
  latestSchedDep?: Date | null;
  latestSchedArr?: Date | null;
  latestEstDep?: Date | null;
  latestEstArr?: Date | null;
  latestGateDep?: string;
  latestGateArr?: string;
  latestStatus?: FlightStatusCode;
};

export type FlightStatusSnapshot = {
  id: string;
  flightId: string;
  provider: string;
  fetchedAt: Date;
  schedDep?: Date;
  schedArr?: Date;
  estDep?: Date;
  estArr?: Date;
  actDep?: Date;
  actArr?: Date;
  gateDep?: string;
  gateArr?: string;
  terminalDep?: string;
  terminalArr?: string;
  status: FlightStatusCode;
  delayReason?: string;
  aircraftType?: string;
  routeKey?: string;
};

// Flight provider DTO (Data Transfer Object)
export type FlightStatusDTO = {
  schedDep?: string;
  schedArr?: string;
  estDep?: string;
  estArr?: string;
  actDep?: string;
  actArr?: string;
  gateDep?: string;
  gateArr?: string;
  terminalDep?: string;
  terminalArr?: string;
  status: FlightStatusCode;
  aircraftType?: string;
  originIata?: string;
  destIata?: string;
  delayReason?: string;
};

// Query parameters for flight providers
export type FlightQuery = {
  carrierIata: string;
  flightNumber: string;
  serviceDateISO: string; // YYYY-MM-DD format
};

// Enhanced flight with latest status
export type FlightWithStatus = Flight & {
  statuses?: FlightStatusSnapshot[];
};

// API response types
export type ApiResponse<T> = {
  data?: T;
  error?: string;
  success: boolean;
};

export type BulkRefreshResult = {
  updated: number;
  errors: string[];
};

// Helper functions for parsing carrier/flight strings
export function parseFlightString(flightStr: string): { carrier: string; number: string } | null {
  const match = flightStr.match(/^([A-Z]{2})(\d{1,4})$/);
  if (!match) return null;
  
  return {
    carrier: match[1],
    number: match[2]
  };
}

export function formatFlightNumber(carrier: string, number: string): string {
  return `${carrier}${number}`;
}

export function parseCarrierFlightNumber(input: string): { carrierIata: string; flightNumber: string } | null {
  // Handle formats like "DL123", "DL 123", "Delta 123"
  const patterns = [
    /^([A-Z]{2})(\d{1,4})$/, // DL123
    /^([A-Z]{2})\s+(\d{1,4})$/, // DL 123
    /^([A-Z]{2,3})\s*(\d{1,4})$/, // DL123 or DAL123
  ];

  for (const pattern of patterns) {
    const match = input.trim().toUpperCase().match(pattern);
    if (match) {
      return {
        carrierIata: match[1].substring(0, 2), // Take first 2 chars for IATA
        flightNumber: match[2]
      };
    }
  }

  return null;
}

// Utility for creating flight identifiers
export function createFlightId(carrier: string, number: string, date: string): string {
  return `${carrier}${number}-${date}`;
}

// Status display helpers
export function getStatusColor(status: FlightStatusCode): string {
  switch (status) {
    case "SCHEDULED":
      return "blue";
    case "BOARDING":
      return "indigo";
    case "DEPARTED":
    case "ENROUTE":
      return "green";
    case "LANDED":
      return "emerald";
    case "DELAYED":
      return "amber";
    case "CANCELLED":
      return "red";
    case "DIVERTED":
      return "orange";
    default:
      return "gray";
  }
}

export function getStatusLabel(status: FlightStatusCode): string {
  switch (status) {
    case "SCHEDULED":
      return "On time";
    case "BOARDING":
      return "Boarding";
    case "DEPARTED":
      return "Departed";
    case "ENROUTE":
      return "En Route";
    case "LANDED":
      return "Landed";
    case "DELAYED":
      return "Delayed";
    case "CANCELLED":
      return "Cancelled";
    case "DIVERTED":
      return "Diverted";
    default:
      return "Unknown";
  }
}
