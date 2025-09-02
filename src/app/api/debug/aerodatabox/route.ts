import { NextRequest, NextResponse } from "next/server";
import { normalizeAirlineCode } from "@/lib/airlineCodes";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const u = new URL(req.url);
    const airline = normalizeAirlineCode((u.searchParams.get("airline") || "").toUpperCase());
    const number = (u.searchParams.get("number") || "").replace(/\D/g, "");
    const date = (u.searchParams.get("date") || "").trim();

    if (!airline || !number || !date) {
      return NextResponse.json({ error: "airline, number, and date are required" }, { status: 400 });
    }

    const apiKey = process.env.AERODATA_API_KEY || process.env.AERODATABOX_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Missing AERODATABOX_API_KEY" }, { status: 500 });
    }

    const url = `https://aerodatabox.p.rapidapi.com/flights/number/${airline}${number}/${date}`;
    const r = await fetch(url, {
      headers: {
        "X-RapidAPI-Key": apiKey,
        "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
      },
      cache: "no-store",
    });

    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
