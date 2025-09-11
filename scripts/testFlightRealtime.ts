// Test script: create (or find) flight 9E5225 for today and invoke realtime route.
import { getPrisma } from "../src/lib/db";
import { FlightStatusCode } from "@prisma/client";
import { NextRequest } from "next/server";
import { GET as realtimeGet } from "../src/app/api/flights/[id]/realtime/route";
import { normalizeAirlineCode } from "../src/lib/airlineCodes";

async function ensureFlight(carrierRaw: string, flightNumber: string) {
  const prisma = getPrisma();
  const carrierIata = normalizeAirlineCode(carrierRaw); // EDV -> 9E
  const fixed = new Date('2025-09-10T00:00:00Z');
  const existing = await prisma.flight.findFirst({ where: { carrierIata, flightNumber, serviceDate: fixed } });
  if (existing) return existing;
  // Don't create a new record if manual override expected but missing; create minimal placeholder
  return prisma.flight.create({ data: { carrierIata, flightNumber, serviceDate: fixed, notes: 'Inserted for realtime test', latestStatus: FlightStatusCode.SCHEDULED } });
}

async function main() {
  const carrier = "EDV"; // ICAO provided by user
  const number = "5225";
  const flight = await ensureFlight(carrier, number);
  console.log("Flight record:", { id: flight.id, carrierIata: flight.carrierIata, flightNumber: flight.flightNumber, serviceDate: flight.serviceDate.toISOString().slice(0,10) });

  const res = await realtimeGet(new NextRequest('http://local.test/realtime'), { params: Promise.resolve({ id: flight.id }) });
  const json = await (res as Response).json();
  console.log("Realtime response:\n", JSON.stringify(json, null, 2));
}

main().catch(err => { console.error(err); process.exit(1); });
