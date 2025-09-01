import { FlightStatusDTO, FlightStatusCode } from "./types";

export function statusFromDTO(dto: FlightStatusDTO): FlightStatusCode {
  return dto.status || FlightStatusCode.UNKNOWN;
}
