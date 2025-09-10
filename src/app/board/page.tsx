"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { iataToIana, formatAirportWithCity } from "@/lib/airports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  RefreshCw, 
  Upload, 
  Plane,
  MapPin,
  Search,
  Filter,
  Trash2,
  ArrowRight,
  Clock,
  User,
  ChevronUp,
  ChevronDown,
  Calendar
} from "lucide-react";
import React from "react";
import { useFlights, useRefreshAllFlights, useDeleteFlight, useRefreshFlight } from "@/hooks/useFlights";
import { useRealtimeFlight } from "@/hooks/useRealtimeFlight";

function RealtimeProgressInline({ flightId, flight }: { flightId: string; flight?: Flight }) {
  const { data: rt, error } = useRealtimeFlight(flightId, 300000); // Poll every 5 minutes
  
  // If we have an error or no data but have flight data, try to compute fallback progress
  if ((!rt || error) && flight) {
    const now = new Date();
    const depTime = flight.latestEstDep || flight.latestSchedDep;
    const arrTime = flight.latestEstArr || flight.latestSchedArr;
    
    if (depTime && arrTime) {
      const depMs = new Date(depTime).getTime();
      const arrMs = new Date(arrTime).getTime();
      const nowMs = now.getTime();
      
      let percent = 0;
      let departed = false;
      let landed = false;
      
      // Debug: Log the times to see what we're working with
      console.log(`Fallback calc for flight ${flightId}:`, {
        depTime: depTime.toString(),
        arrTime: arrTime.toString(),
        now: now.toString(),
        depMs,
        arrMs,
        nowMs,
        depPassed: nowMs >= depMs,
        arrPassed: nowMs >= arrMs
      });
      
      if (nowMs >= arrMs) {
        percent = 100;
        departed = true;
        landed = true;
      } else if (nowMs >= depMs) {
        percent = Math.round(((nowMs - depMs) / (arrMs - depMs)) * 100);
        departed = true;
      }
      
      console.log(`Fallback result for ${flightId}:`, { percent, departed, landed });
      
      return (
        <div className="mt-3 space-y-2">
          {/* Status badge */}
          {(departed || landed) && (
            <div className="flex justify-center">
              <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                landed 
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                  : 'bg-green-50 text-green-700 border border-green-200'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${landed ? 'bg-emerald-500' : 'bg-green-500'}`} />
                {landed ? 'Landed' : 'Departed'}
              </div>
            </div>
          )}
          
          <div className="space-y-1">
            <div className="flex items-center">
              <span className="text-xs font-medium text-slate-600">Progress</span>
              <span className="text-xs text-slate-500 ml-auto">{percent}%</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200 overflow-hidden" aria-label="flight progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
              <div 
                className={`h-full transition-all duration-500 ease-out ${
                  landed ? 'bg-emerald-500' : departed ? 'bg-green-500' : 'bg-slate-400'
                }`} 
                style={{ width: `${percent}%` }} 
              />
            </div>
          </div>
        </div>
      );
    }
    
    // No usable time data
    return (
      <div className="mt-3 space-y-2">
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Progress</span>
            <span className="text-xs text-slate-400">—</span>
          </div>
          <div className="h-2 rounded-full bg-slate-200 overflow-hidden" aria-label="flight progress unavailable">
            <div className="h-full bg-slate-300 w-0" />
          </div>
        </div>
      </div>
    );
  }
  
  if (!rt) return null; // This shouldn't happen due to above checks, but for type safety
  
  let percent = rt.progress?.percent ?? 0;
  let departed = rt.progress?.departed;
  let landed = rt.progress?.landed;
  
  // If the realtime API returned data but no departure/landing status,
  // and percent is 0, it's likely all flights are in the future
  if (percent === 0 && !departed && !landed && flight) {
    // Use stored flight times as additional check
    const now = new Date();
    const depTime = flight.latestEstDep || flight.latestSchedDep;
    const arrTime = flight.latestEstArr || flight.latestSchedArr;
    
    if (depTime && arrTime) {
      const depMs = new Date(depTime).getTime();
      const arrMs = new Date(arrTime).getTime();
      const nowMs = now.getTime();
      
      if (nowMs >= arrMs) {
        percent = 100;
        departed = true;
        landed = true;
      } else if (nowMs >= depMs) {
        percent = Math.round(((nowMs - depMs) / (arrMs - depMs)) * 100);
        departed = true;
      }
    }
  }
  
  // Choose progress bar color based on status
  const getProgressColor = () => {
    if (landed) return 'bg-emerald-500';
    if (departed) return 'bg-green-500';
    return 'bg-slate-400';
  };

  // Determine what status badge to show
  const getStatusBadge = () => {
    if (landed) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Landed
        </div>
      );
    }
    if (departed) {
      return (
        <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
          <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
          Departed
        </div>
      );
    }
    return null;
  };

  return (
    <div className="mt-3 space-y-2">
      {/* Status badge - only show if departed or landed */}
      {(() => {
        const statusBadge = getStatusBadge();
        return statusBadge && (
          <div className="flex justify-center">
            {statusBadge}
          </div>
        );
      })()}
      
      {/* Progress bar with percentage */}
      <div className="space-y-1">
        <div className="flex items-center">
          <span className="text-xs font-medium text-slate-600">Progress</span>
          <span className="text-xs text-slate-500 ml-auto">{percent}%</span>
        </div>
        <div className="h-2 rounded-full bg-slate-200 overflow-hidden" aria-label="flight progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full transition-all duration-500 ease-out ${getProgressColor()}`} style={{ width: `${percent}%` }} />
        </div>
      </div>
    </div>
  );
}

// ---------------- Journey-based Connecting Flights ----------------
// New UX pattern: Journey header + vertical timeline with legs
const MAX_CONNECTION_HOURS = 8;
type BoardFlight = Flight; // alias for clarity

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

function toDate(maybe: Date | string | null | undefined): Date | undefined {
  if (!maybe) return undefined; return typeof maybe === 'string' ? new Date(maybe) : maybe;
}
function depTime(f: BoardFlight): Date | undefined { return toDate(f.latestEstDep || f.latestSchedDep); }
function arrTime(f: BoardFlight): Date | undefined { return toDate(f.latestEstArr || f.latestSchedArr); }

function flightToLeg(flight: BoardFlight): FlightLeg {
  const depScheduled = toDate(flight.latestSchedDep);
  const depActual = toDate(flight.latestEstDep);
  const arrScheduled = toDate(flight.latestSchedArr);
  const arrEstimated = toDate(flight.latestEstArr);
  
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
  
  for (const f of flightsSorted) {
    if (!remaining.has(f.id)) continue;
    const chain: BoardFlight[] = [f];
    remaining.delete(f.id);
    let last = f;
    
    // try to extend forward greedily
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

function formatHm(d?: Date) { if (!d) return '—'; return d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'}); }

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
import { displayFlightIata } from "@/lib/airlineCodes";
import { QuotaDisplay } from "@/components/quota-display";

export default function BoardPage() {
  const router = useRouter();
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

  const handleDeleteFlight = async (flightId: string, flightDetails: string) => {
    if (confirm(`Delete flight ${flightDetails}?`)) {
      try {
        await deleteMutation.mutateAsync(flightId);
      } catch (error) {
        console.error('Failed to delete flight:', error);
        alert('Failed to delete flight. Please try again.');
      }
    }
  };

  const clearFilters = () => {
    setSearchQuery("");
    setYearFilter("");
    setMonthFilter("");
    setDayFilter("");
  };

  const formatDateTime = (date?: Date | string | null, tz?: string) => {
    if (!date) return "—";
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      if (tz) return formatInTimeZone(d, tz, "EEE, MMM d, h:mm a");
      return format(d, "EEE, MMM d, h:mm a");
    } catch {
      return "—";
    }
  };

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

  const getStatusBadge = (flight: Flight) => {
    const status = flight.latestStatus;
    if (!status) return null;

    const color = getStatusColor(status);
    // Prefer arrival deltas if available, else departure
    const arrDelta = computeDelayMinutes(flight.latestSchedArr, flight.latestEstArr, null);
    const depDelta = computeDelayMinutes(flight.latestSchedDep, flight.latestEstDep, null);
    const delta = arrDelta !== null ? arrDelta : depDelta;
    const derived = formatDeltaLabel(delta);
    const base = getStatusLabel(status);
    const label = derived ?? base;
    
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      blue: "default",
      indigo: "secondary", 
      green: "secondary",
      emerald: "secondary",
      amber: "secondary",
      red: "destructive",
      orange: "secondary",
      gray: "outline"
    };

  return (
      <Badge variant={variants[color] || "outline"} className={`bg-${color}-50 text-${color}-700 border-${color}-200`}>
    {label}
      </Badge>
    );
  };

  const handleCardNavigate = (e: React.MouseEvent | React.KeyboardEvent, id: string) => {
    const target = e.target as HTMLElement;
    // Ignore clicks originating from interactive elements
    if (target.closest('button, a, [role="button"], [data-no-nav]')) return;
    if ('key' in e) {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
    }
    router.push(`/flight/${id}`);
  };

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-slate-900 mb-2">Flight Board</h1>
              <p className="text-slate-600">Real-time flight tracking for your group</p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                onClick={handleRefresh} 
                disabled={refreshMutation.isPending}
                className="transition-all duration-200 hover:scale-105"
              >
                <RefreshCw className={`h-4 w-4 mr-2 transition-transform duration-300 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                asChild
                className="transition-all duration-200 hover:scale-105"
              >
                <a href="/upload">
                  <Upload className="h-4 w-4 mr-2" />
                  Add Flights
                </a>
              </Button>
            </div>
          </div>

          {/* Search and Filter Controls */}
          <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Search flights..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 border-slate-200 focus:border-blue-400 transition-colors"
                  />
                </div>
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    placeholder="Year (e.g., 2025)"
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="pl-10 border-slate-200 focus:border-blue-400 transition-colors"
                  />
                </div>
                <Input
                  placeholder="Month (1-12)"
                  value={monthFilter}
                  onChange={(e) => setMonthFilter(e.target.value)}
                  className="border-slate-200 focus:border-blue-400 transition-colors"
                />
                <Input
                  placeholder="Day (1-31)"
                  value={dayFilter}
                  onChange={(e) => setDayFilter(e.target.value)}
                  className="border-slate-200 focus:border-blue-400 transition-colors"
                />
                <Button 
                  variant="outline" 
                  onClick={clearFilters} 
                  className="transition-all duration-200 hover:bg-slate-50"
                >
                  Clear
                </Button>
              </div>
              <div className="mt-4 text-sm text-slate-500">
                {flights.length} flight{flights.length !== 1 ? 's' : ''} found
              </div>
            </CardContent>
          </Card>

          {/* API Quota Status */}
          <QuotaDisplay />
        </div>

        {/* Flights by Date */}
        {isLoading ? (
          <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <RefreshCw className="h-8 w-8 text-slate-400 mx-auto mb-4 animate-spin" />
                <p className="text-slate-500">Loading flights...</p>
              </div>
            </CardContent>
          </Card>
        ) : sortedDates.length === 0 ? (
          <Card className="shadow-sm border-0 bg-white/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <Plane className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 mb-6">No flights found</p>
                <Button asChild variant="outline">
                  <a href="/upload">Add Your First Flight</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {sortedDates.map((dateKey) => (
              <Card key={dateKey} className="shadow-sm border-0 bg-white/70 backdrop-blur-sm transition-all duration-300 hover:shadow-md">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-3 text-xl font-semibold text-slate-800">
                      <div className="w-2 h-8 bg-gradient-to-b from-blue-500 to-blue-600 rounded-full"></div>
                      {formatInTimeZone(new Date(dateKey), 'UTC', 'EEEE, MMMM d, yyyy')}
                    </CardTitle>
                    <Badge variant="secondary" className="bg-slate-100 text-slate-600">
                      {flightsByDate[dateKey].length} flight{flightsByDate[dateKey].length !== 1 ? 's' : ''}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const dateFlights = flightsByDate[dateKey];
                    const itineraries = buildItineraries(dateFlights);
                    const multiLegItineraries = itineraries.filter(it => it.legs.length > 1);
                    const groupedIds = new Set(multiLegItineraries.flatMap(it => it.legs.map(leg => leg.id)));
                    const singles = dateFlights.filter(f => !groupedIds.has(f.id));
                    return (
                      <div className="space-y-6">
                        {/* Journey Cards */}
                        {multiLegItineraries.map(itinerary => (
                          <JourneyCard key={itinerary.id} itinerary={itinerary} />
                        ))}
                        {/* Single Flights */}
                        <div className="grid gap-4">
                          {singles.map(flight => (
                            <Card
                              key={flight.id}
                              className="transition-all duration-200 hover:shadow-sm border border-slate-200 bg-white cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                              role="button"
                              tabIndex={0}
                              onClick={(e) => handleCardNavigate(e, flight.id)}
                              onKeyDown={(e) => handleCardNavigate(e, flight.id)}
                            >
                              <CardContent className="p-6">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-6">
                                    <div className="text-center">
                                      <div className="text-lg font-bold text-slate-900">{displayFlightIata(flight.carrierIata, flight.flightNumber)}</div>
                                      <div className="text-sm text-slate-500">{flight.notes || "—"}</div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                      <div className="text-center min-w-[120px]">
                                        <div className="text-2xl font-bold text-slate-700">{(() => { const airport = formatAirportWithCity(flight.originIata); return (<div><div>{airport.code}</div>{airport.city && <div className="text-xs text-slate-500 font-normal">{airport.city}</div>}</div>); })()}</div>
                                        <div className="text-xs text-slate-500 mt-1">{formatDateTime(flight.latestEstDep || flight.latestSchedDep, iataToIana(flight.originIata))}</div>
                                      </div>
                                      <div className="flex flex-col items-center justify-center min-w-[180px]">
                                        <div className="flex items-center mb-2">
                                          <div className="w-8 h-px bg-slate-300"></div>
                                          <ArrowRight className="h-4 w-4 text-slate-400 mx-2" />
                                          <div className="w-8 h-px bg-slate-300"></div>
                                        </div>
                                        <RealtimeProgressInline flightId={flight.id} flight={flight} />
                                      </div>
                                      <div className="text-center min-w-[120px]">
                                        <div className="text-2xl font-bold text-slate-700">{(() => { const airport = formatAirportWithCity(flight.destIata); return (<div><div>{airport.code}</div>{airport.city && <div className="text-xs text-slate-500 font-normal">{airport.city}</div>}</div>); })()}</div>
                                        <div className="text-xs text-slate-500 mt-1">{formatDateTime(flight.latestEstArr || flight.latestSchedArr, iataToIana(flight.destIata))}</div>
                                      </div>
                                    </div>
                                    {(flight.latestGateDep || flight.latestGateArr || flight.latestTerminalDep || flight.latestTerminalArr) && (
                                      <div className="flex items-center gap-3 text-sm text-slate-600">
                                        <MapPin className="h-4 w-4" />
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                          <span>{`Dep: ${flight.latestGateDep ? `Gate ${flight.latestGateDep}` : (flight.latestTerminalDep ? `Terminal ${flight.latestTerminalDep}` : '—')}`}{flight.latestGateDep && flight.latestTerminalDep ? ` · Term ${flight.latestTerminalDep}` : ''}</span>
                                          <span className="hidden sm:inline">|</span>
                                          <span>{`Arr: ${flight.latestGateArr ? `Gate ${flight.latestGateArr}` : (flight.latestTerminalArr ? `Terminal ${flight.latestTerminalArr}` : '—')}`}{flight.latestGateArr && flight.latestTerminalArr ? ` · Term ${flight.latestTerminalArr}` : ''}</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="sm" onClick={(e)=>{e.stopPropagation(); refreshOne.mutate(flight.id);}} disabled={refreshOne.isPending} className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors" title="Refresh this flight">
                                      <RefreshCw className={`h-4 w-4 ${refreshOne.isPending ? 'animate-spin' : ''}`} />
                                    </Button>
                                    {getStatusBadge(flight)}
                                    <Button variant="ghost" size="sm" onClick={(e)=>{e.stopPropagation(); handleDeleteFlight(flight.id, `${flight.carrierIata}${flight.flightNumber}`);}} disabled={deleteMutation.isPending} className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors">
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
