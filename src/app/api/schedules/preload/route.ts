import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db";
import { AviationstackProvider, toServiceDateLocalUTC } from "@/lib/providers/aviationstack";

const prisma = getPrisma();
const provider = new AviationstackProvider();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { airportIata, date, type } = body as { airportIata: string; date: string; type: "departure" | "arrival" };

    if (!airportIata || !date || !type) {
      return NextResponse.json({ error: "airportIata, date, type are required" }, { status: 400 });
    }

    const flights = await provider.fetchFutureSchedulesByAirport({ iataCode: airportIata, date, type });

    let upserts = 0;
    for (const f of flights) {
      const carrierIata = f.airline?.iata || "";
      const flightNumber = f.flight?.number || "";
      const originIata = f.departure?.iata || undefined;
      const destIata = f.arrival?.iata || undefined;
      if (!carrierIata || !flightNumber) continue;

      // Derive serviceDate from origin local time if possible
      const serviceDate = toServiceDateLocalUTC(originIata, f.departure?.scheduled || undefined) || new Date(`${date}T00:00:00Z`);

      // Find or create Flight
      const existing = await prisma.flight.findFirst({
        where: { carrierIata, flightNumber, serviceDate },
      });

      const flight = existing
        ? await prisma.flight.update({ where: { id: existing.id }, data: { originIata, destIata } })
        : await prisma.flight.create({ data: { carrierIata, flightNumber, serviceDate, originIata, destIata } });

      // Upsert Schedule
      await prisma.schedule.upsert({
        where: { id: flight.id },
        update: {
          schedDep: f.departure?.scheduled ? new Date(f.departure.scheduled) : null,
          schedArr: f.arrival?.scheduled ? new Date(f.arrival.scheduled) : null,
          equipment: f.aircraft?.iata || null,
          gateDep: f.departure?.gate || null,
          gateArr: f.arrival?.gate || null,
          terminalDep: f.departure?.terminal || null,
          terminalArr: f.arrival?.terminal || null,
          source: "Aviationstack",
        },
        create: {
          id: flight.id,
          flightId: flight.id,
          schedDep: f.departure?.scheduled ? new Date(f.departure.scheduled) : null,
          schedArr: f.arrival?.scheduled ? new Date(f.arrival.scheduled) : null,
          equipment: f.aircraft?.iata || null,
          gateDep: f.departure?.gate || null,
          gateArr: f.arrival?.gate || null,
          terminalDep: f.departure?.terminal || null,
          terminalArr: f.arrival?.terminal || null,
          source: "Aviationstack",
        },
      });

      // Also update denormalized fields
      await prisma.flight.update({
        where: { id: flight.id },
        data: {
          latestSchedDep: f.departure?.scheduled ? new Date(f.departure.scheduled) : undefined,
          latestSchedArr: f.arrival?.scheduled ? new Date(f.arrival.scheduled) : undefined,
        },
      });

      upserts++;
    }

    return NextResponse.json({ success: true, data: { upserts } });
  } catch (error) {
    console.error("Preload schedules error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
