import { FlightStatusDTO, FlightQuery } from "../types";

export interface FlightProvider {
  getStatus(query: FlightQuery): Promise<FlightStatusDTO | null>;
}

export class FlightProviderError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "FlightProviderError";
  }
}
