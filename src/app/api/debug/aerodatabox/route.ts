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

    const apiMarketKey = process.env.API_MARKET_KEY;
    const rapidKey = process.env.AERODATA_API_KEY || process.env.AERODATABOX_API_KEY;
    const isApiMarket = !!apiMarketKey;
    if (!apiMarketKey && !rapidKey) {
      return NextResponse.json({ error: "Missing API_MARKET_KEY or AERODATABOX_API_KEY" }, { status: 500 });
    }

    const url = `${isApiMarket ? 'https://prod.api.market/api/v1/aedbx/aerodatabox' : 'https://aerodatabox.p.rapidapi.com'}/flights/number/${airline}${number}/${date}`;
    const headers: Record<string, string> = isApiMarket
      ? { "x-api-market-key": String(apiMarketKey), "Accept": "application/json" }
      : { "X-RapidAPI-Key": String(rapidKey), "X-RapidAPI-Host": "aerodatabox.p.rapidapi.com" };
    const r = await fetch(url, { headers, cache: "no-store" });

    const text = await r.text();
    return new NextResponse(text, { status: r.status, headers: { "content-type": "application/json" } });
  } catch (e) {
    const err = e as Error;
    return NextResponse.json({ error: err.message || "Unknown error" }, { status: 500 });
  }
}
