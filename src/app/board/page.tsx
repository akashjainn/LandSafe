"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
// removed unused format import
import { formatInTimeZone } from "date-fns-tz";
import * as tz from "date-fns-tz";
import { iataToIana } from "@/lib/airports";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
// removed unused Badge import
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Upload, 
  Plane,
  MapPin,
  Search,
  Filter,
  ArrowRight,
  Clock,
  User,
  ChevronUp,
  ChevronDown,
  Calendar
} from "lucide-react";
import React from "react";
import { useFlights, useRefreshAllFlights, useDeleteFlight, useRefreshFlight } from "@/hooks/useFlights";
// removed unused useRealtimeFlight import

// (Removed legacy RealtimeProgressInline component – replaced by unified FlightProgress elsewhere)

// ---------------- Journey-based Connecting Flights ----------------
// New UX pattern: Journey header + vertical timeline with legs
const MAX_CONNECTION_HOURS = 8;
// Extend Flight with optional manual grouping and traveler hint for future use
type BoardFlight = Flight & {
  connectionGroupId?: string | null;
  traveler?: string | null;
};

type FlightLeg = {
  id: string;
  marketingCarrier: string;
  flightNumber: string;
  dep: { 
    iata: string; 
    timeSched: Date; 
    timeAct?: Date; 
    gate?: string; 
    terminal?: string; 
  };
  arr: { 
    iata: string; 
    timeSched: Date; 
    timeEst?: Date; 
    timeAct?: Date; 
    gate?: string; 
    terminal?: string; 
    belt?: string; 
  };
  status: "SCHEDULED"|"BOARDING"|"DEPARTED"|"ENROUTE"|"LANDED"|"CANCELLED"|"DIVERTED";
  notes?: string; // passenger label/name
  originalFlight: BoardFlight; // reference to original data
};

type Itinerary = {
  id: string;
  legs: FlightLeg[];
  totalDurationMin: number;
  origin: string;
  destination: string;
}

// Normalize timestamps to UTC instants for reliable layover math.
// If a string lacks timezone info, interpret in the airport's local IANA zone and convert to UTC.
function hasTZInfo(s: string) {
  return /[zZ]$|[+-]\d{2}:?\d{2}$/.test(s);
}
function toUTCDate(
  maybe: Date | string | null | undefined,
  airportIata: string | null | undefined
): Date | undefined {
  if (!maybe) return undefined;
  if (maybe instanceof Date) return maybe;
  const str = String(maybe);
  if (hasTZInfo(str)) return new Date(str);
  const ianaTz = iataToIana(airportIata || "") || "UTC";
  // Interpret naive local time in the airport's timezone, then convert to UTC
  // Access via namespace to avoid type export issues
  // Access via namespace, typed safely without `any`
  const mod = tz as unknown as { zonedTimeToUtc?: (d: string | Date, tz: string) => Date };
  return mod.zonedTimeToUtc ? mod.zonedTimeToUtc(str, ianaTz) : new Date(str + "Z");
}
function depTime(f: BoardFlight): Date | undefined { return toUTCDate(f.latestEstDep || f.latestSchedDep, f.originIata); }
function arrTime(f: BoardFlight): Date | undefined { return toUTCDate(f.latestEstArr || f.latestSchedArr, f.destIata); }

function flightToLeg(flight: BoardFlight): FlightLeg {
  // Simple parser for display; layover math uses UTC-normalized helpers above
  function toDateSimple(maybe: Date | string | null | undefined): Date | undefined {
    if (!maybe) return undefined; return typeof maybe === 'string' ? new Date(maybe) : maybe;
  }
  const depScheduled = toDateSimple(flight.latestSchedDep);
  const depActual = toDateSimple(flight.latestEstDep);
  const arrScheduled = toDateSimple(flight.latestSchedArr);
  const arrEstimated = toDateSimple(flight.latestEstArr);
  
  // Map flight status to our enum
  const mapStatus = (status?: string): FlightLeg['status'] => {
    switch (status?.toUpperCase()) {
      case 'BOARDING': return 'BOARDING';
      case 'DEPARTED': return 'DEPARTED';
      case 'ENROUTE': return 'ENROUTE';
      case 'LANDED': return 'LANDED';
      case 'CANCELLED': return 'CANCELLED';
      case 'DIVERTED': return 'DIVERTED';
      default: return 'SCHEDULED';
    }
  };
  
  return {
    id: flight.id,
    marketingCarrier: flight.carrierIata,
    flightNumber: flight.flightNumber,
    dep: {
      iata: flight.originIata || '???',
      timeSched: depScheduled || new Date(),
      timeAct: depActual,
      gate: flight.latestGateDep,
      terminal: flight.latestTerminalDep || undefined,
    },
    arr: {
      iata: flight.destIata || '???',
      timeSched: arrScheduled || new Date(),
      timeEst: arrEstimated,
      gate: flight.latestGateArr,
      terminal: flight.latestTerminalArr || undefined,
    },
    status: mapStatus(flight.latestStatus),
    notes: flight.notes || undefined,
    originalFlight: flight
  };
}

function buildItineraries(flights: BoardFlight[]): Itinerary[] {
  const remaining = new Set(flights.map(f=>f.id));
  const byId: Record<string, BoardFlight> = Object.fromEntries(flights.map(f=>[f.id,f]));
  const itineraries: Itinerary[] = [];
  const flightsSorted = [...flights].sort((a,b) => (depTime(a)?.getTime()||0) - (depTime(b)?.getTime()||0));

  // 0) Respect explicit manual grouping when provided via connectionGroupId
  const explicitGroups = new Map<string, BoardFlight[]>();
  for (const f of flightsSorted) {
    if (f.connectionGroupId) {
      const k = f.connectionGroupId;
      if (!explicitGroups.has(k)) explicitGroups.set(k, []);
      explicitGroups.get(k)!.push(f);
    }
  }
  for (const [, list] of explicitGroups) {
    list.sort((a,b)=> (depTime(a)?.getTime()||0) - (depTime(b)?.getTime()||0));
    list.forEach(f=> remaining.delete(f.id));
    const legs = list.map(flightToLeg);
    const firstDep = legs[0].dep.timeSched;
    const lastArr = legs[legs.length-1].arr.timeEst || legs[legs.length-1].arr.timeSched;
    const totalDurationMin = Math.max(0, Math.round((lastArr.getTime() - firstDep.getTime()) / 60000));
    itineraries.push({
      id: list.map(l=>l.id).join('_'),
      legs,
      totalDurationMin,
      origin: legs[0].dep.iata,
      destination: legs[legs.length-1].arr.iata,
    });
  }
  
  for (const f of flightsSorted) {
    if (!remaining.has(f.id)) continue;
    const chain: BoardFlight[] = [f];
    remaining.delete(f.id);
    let last = f;
    
  // try to extend forward greedily (UTC-normalized times)
    while (true) {
      const lastArr = arrTime(last);
      if (!lastArr || !last.destIata) break;
      // candidates: remaining flights whose origin matches last dest and dep within window and after arrival
      const candidates: BoardFlight[] = [];
      remaining.forEach(id => {
        const cand = byId[id];
        if (!cand || cand.originIata !== last.destIata) return;
        const d = depTime(cand); if (!d) return;
        if (d.getTime() < lastArr.getTime()) return; // must depart after arrival
        const hoursDiff = (d.getTime() - lastArr.getTime()) / 3600000;
        if (hoursDiff <= MAX_CONNECTION_HOURS) candidates.push(cand);
      });
      if (!candidates.length) break;
      // pick earliest departure candidate
      candidates.sort((a,b)=>(depTime(a)?.getTime()||0) - (depTime(b)?.getTime()||0));
      const next = candidates[0];
      chain.push(next);
      remaining.delete(next.id);
      last = next;
    }
    
    // Convert to itinerary
    const legs = chain.map(flightToLeg);
    const firstDep = legs[0].dep.timeSched;
    const lastArr = legs[legs.length-1].arr.timeEst || legs[legs.length-1].arr.timeSched;
    const totalDurationMin = Math.round((lastArr.getTime() - firstDep.getTime()) / 60000);
    
    const itinerary: Itinerary = {
      id: chain.map(c=>c.id).join('_'),
      legs,
      totalDurationMin,
      origin: legs[0].dep.iata,
      destination: legs[legs.length-1].arr.iata
    };
    itineraries.push(itinerary);
  }
  return itineraries;
}

// -------- Round-trip pairing (outbound + inbound) --------
type RoundTrip = {
  key: string;
  outbound: Itinerary;
  inbound: Itinerary;
  daysAway: number;
};

function firstDep(it: Itinerary): Date {
  return it.legs[0].dep.timeSched;
}
function lastArr(it: Itinerary): Date {
  const last = it.legs[it.legs.length - 1];
  return last.arr.timeEst || last.arr.timeSched;
}

function defaultSameCity(iata: string): string {
  const m: Record<string, string> = {
    JFK: "NYC", LGA: "NYC", EWR: "NYC",
    NRT: "TYO", HND: "TYO",
    DCA: "WAS", IAD: "WAS", BWI: "WAS",
    ORD: "CHI", MDW: "CHI",
    LHR: "LON", LGW: "LON", LCY: "LON", STN: "LON", LTN: "LON",
  };
  return m[iata] ?? iata;
}

function pairRoundTrips(
  trips: Itinerary[],
  opts: { minReturnHours?: number; maxReturnDays?: number; sameCity?: (iata: string) => string } = {}
): { pairs: RoundTrip[]; singles: Itinerary[] } {
  const minReturnHours = opts.minReturnHours ?? 6;
  const maxReturnDays = opts.maxReturnDays ?? 90;
  const toCity = opts.sameCity ?? defaultSameCity;

  const sorted = [...trips].sort((a, b) => firstDep(a).getTime() - firstDep(b).getTime());
  const used = new Set<string>();
  const pairs: RoundTrip[] = [];
  const singles: Itinerary[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const out = sorted[i];
    if (used.has(out.id)) continue;

    const A = toCity(out.origin);
    const B = toCity(out.destination);
    const outArr = lastArr(out).getTime();

    let best: { idx: number; score: number } | null = null;
    for (let j = i + 1; j < sorted.length; j++) {
      const ret = sorted[j];
      if (used.has(ret.id)) continue;

      const C = toCity(ret.origin);
      const D = toCity(ret.destination);
      const retDep = firstDep(ret).getTime();

      const hoursGap = (retDep - outArr) / 3_600_000;
      const daysGap = hoursGap / 24;
      const endpointsMatch = (B === C) && (A === D);
      const timeOK = hoursGap >= minReturnHours && daysGap <= maxReturnDays;

      if (endpointsMatch && timeOK) {
        const score = 10 - Math.abs(hoursGap - 24); // prefer closer-to-24h returns
        if (!best || score > best.score) best = { idx: j, score };
      }
    }

    if (best) {
      const ret = sorted[best.idx];
      used.add(out.id); used.add(ret.id);
      pairs.push({
        key: `${out.id}|${ret.id}`,
        outbound: out,
        inbound: ret,
        daysAway: Math.round((firstDep(ret).getTime() - lastArr(out).getTime()) / 86_400_000),
      });
    } else {
      used.add(out.id);
      singles.push(out);
    }
  }

  for (const t of sorted) if (!used.has(t.id)) singles.push(t);
  return { pairs, singles };
}

function RoundTripCard({ rt }: { rt: RoundTrip }) {
  return (
    <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-lg font-semibold text-slate-800">
            {rt.outbound.origin} ⇄ {rt.inbound.destination}
          </div>
          <div className="text-sm text-slate-500">{rt.daysAway} day{rt.daysAway === 1 ? '' : 's'} apart</div>
        </div>
        <div className="space-y-3">
          <JourneyCard itinerary={rt.outbound} />
          <div className="text-center text-xs text-slate-500">return</div>
          <JourneyCard itinerary={rt.inbound} />
        </div>
      </CardContent>
    </Card>
  );
}

function formatHm(d?: Date) { if (!d) return '—'; return d.toLocaleTimeString(undefined,{hour:'numeric',minute:'2-digit',hour12:true}); }

function calculateOverallProgress(itinerary: Itinerary): number {
  const now = new Date();
  const start = itinerary.legs[0].dep.timeSched;
  const end = itinerary.legs[itinerary.legs.length - 1].arr.timeEst || 
             itinerary.legs[itinerary.legs.length - 1].arr.timeSched;
  
  if (now.getTime() >= end.getTime()) return 100;
  if (now.getTime() <= start.getTime()) return 0;
  
  return Math.round(((now.getTime() - start.getTime()) / (end.getTime() - start.getTime())) * 100);
}

function StatusBadge({ status }: { status: FlightLeg['status'] }) {
  const config = {
    SCHEDULED: { 
      bg: 'bg-gradient-to-r from-slate-50 to-gray-50', 
      text: 'text-slate-700', 
      border: 'border-slate-300', 
      dot: 'bg-slate-500', 
      label: 'Scheduled' 
    },
    BOARDING: { 
      bg: 'bg-gradient-to-r from-blue-50 to-indigo-50', 
      text: 'text-blue-700', 
      border: 'border-blue-300', 
      dot: 'bg-blue-500 animate-pulse', 
      label: 'Boarding' 
    },
    DEPARTED: { 
      bg: 'bg-gradient-to-r from-emerald-50 to-green-50', 
      text: 'text-emerald-700', 
      border: 'border-emerald-300', 
      dot: 'bg-emerald-500', 
      label: 'Departed' 
    },
    ENROUTE: { 
      bg: 'bg-gradient-to-r from-green-50 to-emerald-50', 
      text: 'text-green-700', 
      border: 'border-green-300', 
      dot: 'bg-green-500 animate-pulse', 
      label: 'En-route' 
    },
    LANDED: { 
      bg: 'bg-gradient-to-r from-purple-50 to-violet-50', 
      text: 'text-purple-700', 
      border: 'border-purple-300', 
      dot: 'bg-purple-500', 
      label: 'Landed' 
    },
    CANCELLED: { 
      bg: 'bg-gradient-to-r from-red-50 to-rose-50', 
      text: 'text-red-700', 
      border: 'border-red-300', 
      dot: 'bg-red-500', 
      label: 'Cancelled' 
    },
    DIVERTED: { 
      bg: 'bg-gradient-to-r from-amber-50 to-yellow-50', 
      text: 'text-amber-700', 
      border: 'border-amber-300', 
      dot: 'bg-amber-500', 
      label: 'Diverted' 
    },
  };
  
  const style = config[status];
  return (
    <div className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border shadow-sm transition-all duration-200 ${style.bg} ${style.text} ${style.border}`}>
      <div className={`w-2 h-2 rounded-full ${style.dot}`} />
      <span>{style.label}</span>
    </div>
  );
}

function LayoverBlock({ prev, next }: { prev: FlightLeg; next: FlightLeg }) {
  const mins = Math.round((next.dep.timeSched.getTime() - prev.arr.timeSched.getTime()) / 60000);
  const risky = mins < 45 || (prev.arr.terminal && next.dep.terminal && prev.arr.terminal !== next.dep.terminal && mins < 75);
  
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  const timeDisplay = hours > 0 ? `${hours}h ${remainingMins}m` : `${mins}m`;
  
  return (
    <div className={`rounded-lg border p-4 ${
      risky 
        ? "bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200 shadow-sm" 
        : "bg-gradient-to-r from-slate-50 to-gray-50 border-slate-200"
    }`}>
      <div className="flex items-center space-x-3">
        <div className={`w-2 h-2 rounded-full ${risky ? 'bg-amber-400' : 'bg-slate-400'}`}></div>
        <div className="flex-1">
          <div className="flex items-center space-x-4 text-sm">
            <div className="font-medium text-slate-700">
              Layover in {next.dep.iata}
            </div>
            <div className={`font-semibold ${risky ? "text-amber-700" : "text-slate-600"}`}>
              {timeDisplay}
            </div>
            {prev.arr.terminal && next.dep.terminal && (
              <div className="text-slate-500 text-xs">
                {prev.arr.terminal} → {next.dep.terminal}
              </div>
            )}
            {risky && (
              <div className="flex items-center space-x-1 px-2 py-1 bg-amber-100 text-amber-700 rounded-md text-xs font-medium">
                <span>⚠</span>
                <span>Tight connection</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function JourneyCard({ itinerary }: { itinerary: Itinerary }) {
  const [open, setOpen] = React.useState(false);
  const overallProgress = calculateOverallProgress(itinerary);
  const currentLegIndex = itinerary.legs.findIndex(leg => {
    const now = new Date();
    return now.getTime() >= leg.dep.timeSched.getTime() && 
           now.getTime() < (leg.arr.timeEst || leg.arr.timeSched).getTime();
  });
  
  const getProgressColor = () => {
    if (overallProgress === 100) return 'bg-gradient-to-r from-purple-500 to-purple-600';
    if (overallProgress > 0) return 'bg-gradient-to-r from-emerald-500 to-green-500';
    return 'bg-slate-300';
  };

  const totalHours = Math.floor(itinerary.totalDurationMin / 60);
  const totalMinutes = itinerary.totalDurationMin % 60;
  const stopCount = itinerary.legs.length - 1;
  
  return (
    <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-blue-50/50 overflow-hidden">
      <CardContent className="p-0">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 text-white p-6">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              {/* Route Display */}
              <div className="flex items-center space-x-3">
                <div className="text-2xl font-bold tracking-wide">
                  {itinerary.origin}
                </div>
                <div className="flex items-center space-x-2">
                  <div className="h-px bg-white/40 w-8"></div>
                  <div className="w-2 h-2 rounded-full bg-white/60"></div>
                  {stopCount > 0 && (
                    <>
                      <div className="h-px bg-white/40 w-6"></div>
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-300"></div>
                    </>
                  )}
                  <div className="h-px bg-white/40 w-8"></div>
                  <ArrowRight className="w-4 h-4 text-white/80" />
                </div>
                <div className="text-2xl font-bold tracking-wide">
                  {itinerary.destination}
                </div>
              </div>
              
              {/* Journey Metadata */}
              <div className="flex items-center space-x-6 text-sm text-blue-200">
                <div className="flex items-center space-x-2">
                  <Clock className="w-4 h-4" />
                  <span>{totalHours}h {totalMinutes}m total</span>
                </div>
                {stopCount > 0 && (
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4" />
                    <span>{stopCount} stop{stopCount > 1 ? 's' : ''}</span>
                  </div>
                )}
                {currentLegIndex >= 0 && (
                  <div className="flex items-center space-x-2">
                    <Plane className="w-4 h-4" />
                    <span>Leg {currentLegIndex + 1} of {itinerary.legs.length} active</span>
                  </div>
                )}
              </div>
            </div>
            
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={() => setOpen(o => !o)} 
              className="bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white transition-all duration-200"
            >
              {open ? (
                <>
                  <ChevronUp className="w-4 h-4 mr-1" />
                  Hide Timeline
                </>
              ) : (
                <>
                  <ChevronDown className="w-4 h-4 mr-1" />
                  Show Timeline
                </>
              )}
            </Button>
          </div>
          
          {/* Overall Progress Bar */}
          <div className="mt-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-blue-200">
              <span className="font-medium">Journey Progress</span>
              <span className="font-semibold">{overallProgress}%</span>
            </div>
            <div className="h-3 rounded-full bg-white/20 overflow-hidden backdrop-blur-sm">
              <div 
                className={`h-full transition-all duration-700 ease-out ${getProgressColor()} shadow-sm`} 
                style={{ width: `${overallProgress}%` }} 
              />
            </div>
          </div>
        </div>
        
        {/* Timeline Section */}
        {open && (
          <div className="p-6 bg-white">
            <div className="space-y-6">
              <div className="flex items-center space-x-2 text-sm text-slate-600 font-medium border-b pb-2">
                <Calendar className="w-4 h-4" />
                <span>Flight Timeline</span>
              </div>
              
              {/* Vertical Timeline */}
              <div className="relative">
                {/* Timeline Line */}
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gradient-to-b from-blue-200 via-slate-200 to-blue-200"></div>
                
                <div className="space-y-8">
                  {itinerary.legs.map((leg, idx) => (
                    <div key={leg.id} className="relative">
                      {/* Timeline Dot */}
                      <div className="absolute left-4 w-4 h-4 rounded-full bg-white border-2 border-blue-500 shadow-lg z-10 flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
                      </div>
                      
                      {/* Flight Card */}
                      <div className="ml-12 bg-gradient-to-r from-slate-50 to-white rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                        {/* Flight Header */}
                        <div className="flex items-start justify-between mb-4">
                          <div className="space-y-1">
                            <div className="flex items-center space-x-3">
                              <div className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-md">
                                Leg {idx + 1}/{itinerary.legs.length}
                              </div>
                              <div className="font-bold text-slate-900 text-lg">
                                {displayFlightIata(leg.marketingCarrier, leg.flightNumber)}
                              </div>
                              <div className="text-slate-500 font-medium">
                                {leg.dep.iata} → {leg.arr.iata}
                              </div>
                            </div>
                            {leg.notes && (
                              <div className="flex items-center space-x-2">
                                <User className="w-3 h-3 text-slate-400" />
                                <span className="text-sm text-slate-600 italic">{leg.notes}</span>
                              </div>
                            )}
                          </div>
                          <StatusBadge status={leg.status} />
                        </div>
                        
                        {/* Flight Details Grid */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {/* Departure */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 text-slate-600 font-medium">
                              <Plane className="w-4 h-4 rotate-45" />
                              <span>Departure</span>
                            </div>
                            <div className="pl-6 space-y-1">
                              <div className="font-semibold text-slate-900">
                                {formatHm(leg.dep.timeAct || leg.dep.timeSched)}
                              </div>
                              {leg.dep.gate && (
                                <div className="text-slate-600">Gate {leg.dep.gate}</div>
                              )}
                              {leg.dep.terminal && (
                                <div className="text-slate-500">Terminal {leg.dep.terminal}</div>
                              )}
                            </div>
                          </div>
                          
                          {/* Arrival */}
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2 text-slate-600 font-medium">
                              <MapPin className="w-4 h-4" />
                              <span>Arrival</span>
                            </div>
                            <div className="pl-6 space-y-1">
                              <div className="font-semibold text-slate-900">
                                {formatHm(leg.arr.timeEst || leg.arr.timeSched)}
                              </div>
                              {leg.arr.gate && (
                                <div className="text-slate-600">Gate {leg.arr.gate}</div>
                              )}
                              {leg.arr.terminal && (
                                <div className="text-slate-500">Terminal {leg.arr.terminal}</div>
                              )}
                              {leg.arr.belt && (
                                <div className="text-slate-500">Baggage {leg.arr.belt}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                      
                      {/* Layover */}
                      {idx < itinerary.legs.length - 1 && (
                        <div className="ml-12 mt-4">
                          <LayoverBlock prev={leg} next={itinerary.legs[idx + 1]} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
import { getStatusColor, getStatusLabel, FlightStatusCode, Flight } from "@/lib/types";
import { FlightCard } from "@/components/flight-card";
import { displayFlightIata } from "@/lib/airlineCodes";
import { QuotaDisplay } from "@/components/quota-display";

export default function BoardPage() {
  const router = useRouter(); // kept for future navigation; suppress unused warning
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [searchQuery, setSearchQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [dayFilter, setDayFilter] = useState("");

  // Build filters object
  const filters = {
    ...(yearFilter && { year: yearFilter }),
    ...(monthFilter && { month: monthFilter }),
    ...(dayFilter && { day: dayFilter }),
  };

  const { data: flights = [], isLoading, error } = useFlights(Object.keys(filters).length > 0 ? filters : undefined);
  const refreshMutation = useRefreshAllFlights();
  const deleteMutation = useDeleteFlight();
  const refreshOne = useRefreshFlight();

  const handleRefresh = () => {
    refreshMutation.mutate(Object.keys(filters).length > 0 ? filters : undefined);
  };

  const handleDeleteFlight = async (flightId: string, _flightDetails: string) => {
    try {
      await deleteMutation.mutateAsync(flightId);
    } catch (error) {
      console.error('Failed to delete flight:', error);
      alert('Failed to delete flight. Please try again.');
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setYearFilter("");
    setMonthFilter("");
    setDayFilter("");
  };

  // removed unused formatDateTime helper (handled elsewhere)

  const formatDeltaLabel = (mins: number | null): string | null => {
    if (mins === null) return null;
    if (mins === 0) return "On time";
    if (mins < 0) return `${Math.abs(mins)} min early`;
    return `${mins} min late`;
  };

  const computeDelayMinutes = (sched?: Date | string | null, est?: Date | string | null, act?: Date | string | null): number | null => {
    const toDate = (d?: Date | string | null) => (typeof d === 'string' ? new Date(d) : d) as Date | undefined;
    const s = toDate(sched);
    const e = toDate(est);
    const a = toDate(act);
    const ref = a || e;
    if (!s || !ref) return null;
    return Math.round((ref.getTime() - s.getTime()) / 60000);
  };

  // removed unused getStatusBadge helper (FlightCard handles status display)

  // removed unused handleCardNavigate (navigation done via explicit links)

  // Filter flights based on search query
  const filteredFlights = flights.filter(flight => {
    if (!searchQuery) return true;
    
    const query = searchQuery.toLowerCase();
    return (
      flight.carrierIata.toLowerCase().includes(query) ||
      flight.flightNumber.toLowerCase().includes(query) ||
      (flight.originIata && flight.originIata.toLowerCase().includes(query)) ||
      (flight.destIata && flight.destIata.toLowerCase().includes(query)) ||
      (flight.notes && flight.notes.toLowerCase().includes(query))
    );
  });

  // Group flights by date
  const flightsByDate = filteredFlights.reduce((groups, flight) => {
    // Use UTC when deriving the service date key to avoid TZ drift
    const dateKey = formatInTimeZone(new Date(flight.serviceDate), 'UTC', 'yyyy-MM-dd');
    if (!groups[dateKey]) {
      groups[dateKey] = [];
    }
    groups[dateKey].push(flight);
    return groups;
  }, {} as Record<string, typeof flights>);

  // Sort dates (most recent first) and sort flights within each date
  // Sort ascending so earlier (chronologically closer/past) dates appear first top-to-bottom
  const sortedDates = Object.keys(flightsByDate).sort((a, b) => a.localeCompare(b));
  
  // Sort flights within each date group
  Object.keys(flightsByDate).forEach(date => {
    flightsByDate[date].sort((a, b) => {
      // Priority order: ENROUTE/BOARDING first, then SCHEDULED by departure time, then others
      const statusPriority: Record<string, number> = {
        [FlightStatusCode.ENROUTE]: 1,
        [FlightStatusCode.BOARDING]: 2,
        [FlightStatusCode.DELAYED]: 3,
        [FlightStatusCode.DEPARTED]: 4,
        [FlightStatusCode.SCHEDULED]: 5,
        [FlightStatusCode.LANDED]: 6,
        [FlightStatusCode.CANCELLED]: 7,
        [FlightStatusCode.DIVERTED]: 8,
        [FlightStatusCode.UNKNOWN]: 9,
      };

      const aPriority = statusPriority[a.latestStatus as string] || 9;
      const bPriority = statusPriority[b.latestStatus as string] || 9;

      if (aPriority !== bPriority) {
        return aPriority - bPriority;
      }

      // If same priority, sort by estimated departure time
      const aTime = a.latestEstDep || a.latestSchedDep;
      const bTime = b.latestEstDep || b.latestSchedDep;

      if (aTime && bTime) {
        return new Date(aTime).getTime() - new Date(bTime).getTime();
      }

      return 0;
    });
  });

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <Card className="w-full max-w-md mx-4">
          <CardContent className="pt-6 text-center">
            <div className="text-red-600 mb-4 font-medium">Unable to load flights</div>
            <Button onClick={() => window.location.reload()} className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 
                      lg:grid lg:grid-cols-[1fr_auto] lg:gap-6">
        {/* LEFT: main content */}
        <div className="space-y-8">
        {/* Header Section */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-900 rounded-2xl shadow-xl text-white p-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            <div className="space-y-4">
              <h1 className="text-4xl font-bold tracking-tight">Flight Board</h1>
              <p className="text-blue-200 text-lg">Real-time flight tracking for your group</p>
            </div>
            
            <div className="flex flex-wrap items-center gap-4">
              <Button 
                onClick={handleRefresh} 
                disabled={refreshMutation.isPending}
                className="bg-white/10 hover:bg-white/20 border-white/20 text-white hover:text-white transition-all duration-200 shadow-lg"
                size="lg"
              >
                <RefreshCw className={`h-5 w-5 mr-2 transition-transform duration-300 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh All'}
              </Button>
              <Button 
                asChild
                className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-lg transition-all duration-200"
                size="lg"
              >
                <a href="/upload">
                  <Upload className="h-5 w-5 mr-2" />
                  Add Flights
                </a>
              </Button>
            </div>
          </div>
        </div>

        {/* Search and Filter Controls */}
        <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Search</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Flight, route, or notes..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/90"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Year</label>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="2025"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="pl-10 border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/90"
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Month</label>
                <Input
                  placeholder="09"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/90"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700">Day</label>
                <Input
                  placeholder="15"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 bg-white/90"
                />
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-700 opacity-0">Clear</label>
                <Button 
                  variant="outline" 
                  onClick={clearFilters} 
                  className="w-full transition-all duration-200 hover:bg-slate-50 border-slate-200"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
            
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-slate-500">
                {flights.length} flight{flights.length !== 1 ? 's' : ''} found
              </div>
              <QuotaDisplay />
            </div>
          </CardContent>
        </Card>

        {/* Flights by Date */}
        {isLoading ? (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <RefreshCw className="h-8 w-8 text-white animate-spin" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">Loading flights...</h3>
                <p className="text-slate-500">Please wait while we fetch your flight data</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedDates.length === 0 ? (
          <Card className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
            <CardContent className="p-12">
              <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-r from-slate-400 to-slate-500 rounded-full mx-auto mb-6 flex items-center justify-center">
                  <Plane className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-slate-700 mb-2">No flights found</h3>
                <p className="text-slate-500 mb-6">Start tracking your flights by adding them to your board</p>
                <Button asChild className="bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-600 hover:to-green-600 text-white border-0 shadow-lg">
                  <a href="/upload">Add Your First Flight</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => (
              <div key={dateKey} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm transition-all duration-300 hover:shadow-xl rounded-xl overflow-hidden">
                {/* Full-width gradient header */}
                <div className="bg-gradient-to-r from-slate-800 to-blue-800 text-white p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xl font-semibold">
                      <Calendar className="w-5 h-5" />
                      {formatInTimeZone(new Date(dateKey), 'UTC', 'EEEE, MMMM d, yyyy')}
                    </div>
                    <div className="px-3 py-1 bg-white/20 rounded-full text-sm font-medium">
                      {flightsByDate[dateKey].length} flight{flightsByDate[dateKey].length !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
                {/* Content area with proper spacing */}
                <div className="p-6">
                  {(() => {
                    const dateFlights = flightsByDate[dateKey];
                    const itineraries = buildItineraries(dateFlights);
                    const multiLegItineraries = itineraries.filter(it => it.legs.length > 1);
                    // Pair round trips among multi-leg itineraries
                    const { pairs: roundTrips, singles: unpairedTrips } = pairRoundTrips(multiLegItineraries);
                    const allGroupedTrips = [...unpairedTrips, ...roundTrips.flatMap(rt => [rt.outbound, rt.inbound])];
                    const groupedIds = new Set(allGroupedTrips.flatMap(it => it.legs.map(leg => leg.id)));
                    const singles = dateFlights.filter(f => !groupedIds.has(f.id));
                    return (
                      <div className="space-y-6">
                        {/* Round Trip Cards */}
                        {roundTrips.map(rt => (
                          <RoundTripCard key={rt.key} rt={rt} />
                        ))}
                        {/* Unpaired Journey Cards */}
                        {unpairedTrips.map(itinerary => (
                          <JourneyCard key={itinerary.id} itinerary={itinerary} />
                        ))}
                        {/* Single Flights */}
                        <div className="space-y-4">
                          {singles.map(flight => (
                            <FlightCard 
                              key={flight.id} 
                              flight={{
                                id: flight.id,
                                flightNumber: flight.flightNumber,
                                airline: flight.carrierIata,
                                originIata: flight.originIata || undefined,
                                destIata: flight.destIata || undefined,
                                latestSchedDep: flight.latestSchedDep || undefined,
                                latestSchedArr: flight.latestSchedArr || undefined,
                                latestEstDep: flight.latestEstDep || undefined,
                                latestEstArr: flight.latestEstArr || undefined,
                                latestStatus: flight.latestStatus,
                                gate: flight.latestGateDep,
                                terminal: flight.latestTerminalDep || undefined,
                                updatedAt: flight.serviceDate,
                                originTerminal: flight.latestTerminalDep || undefined,
                                destTerminal: flight.latestTerminalArr || undefined,
                                passengerName: flight.notes || undefined,
                              }}
                              onDelete={(flightId) => handleDeleteFlight(flightId, `${flight.carrierIata}${flight.flightNumber}`)}
                              onRefresh={(flightId) => refreshOne.mutate(flightId)}
                            />
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>

        {/* RIGHT: rail - only visible on large screens, sticky positioned */}
        <aside className="hidden lg:flex sticky top-24 self-start flex-col gap-2 w-14">
          <Button 
            onClick={handleRefresh} 
            disabled={refreshMutation.isPending}
            size="sm"
            className="w-12 h-12 p-0 bg-white/10 hover:bg-white/20 border-white/20 backdrop-blur-sm"
            title="Refresh All Flights"
          >
            <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          </Button>
          <Button 
            asChild
            size="sm"
            className="w-12 h-12 p-0 bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/20 backdrop-blur-sm"
            title="Add Flights"
          >
            <a href="/upload">
              <Upload className="h-4 w-4" />
            </a>
          </Button>
        </aside>
      </div>
      
      {/* Mobile floating rail - only visible on small/medium screens */}
      <aside className="lg:hidden fixed right-4 bottom-24 z-20 flex flex-col gap-2">
        <Button 
          onClick={handleRefresh} 
          disabled={refreshMutation.isPending}
          size="sm"
          className="w-12 h-12 p-0 bg-white/90 hover:bg-white shadow-lg backdrop-blur-sm"
          title="Refresh All Flights"
        >
          <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
        </Button>
        <Button 
          asChild
          size="sm"
          className="w-12 h-12 p-0 bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg"
          title="Add Flights"
        >
          <a href="/upload">
            <Upload className="h-4 w-4" />
          </a>
        </Button>
      </aside>
    </div>
  );
}
