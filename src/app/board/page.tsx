"use client";

import { useState } from "react";
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
  ArrowRight
} from "lucide-react";
import { useFlights, useRefreshAllFlights, useDeleteFlight, useRefreshFlight } from "@/hooks/useFlights";
import { getStatusColor, getStatusLabel, FlightStatusCode, Flight } from "@/lib/types";
import { displayFlightIata } from "@/lib/airlineCodes";

export default function BoardPage() {
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
  const sortedDates = Object.keys(flightsByDate).sort((a, b) => b.localeCompare(a));
  
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
                  <div className="grid gap-4">
                    {flightsByDate[dateKey].map((flight) => (
                      <Card key={flight.id} className="transition-all duration-200 hover:shadow-sm border border-slate-200 bg-white">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-6">
                              {/* Flight Info */}
                              <div className="text-center">
                                <div className="text-lg font-bold text-slate-900">
                                  {displayFlightIata(flight.carrierIata, flight.flightNumber)}
                                </div>
                                <div className="text-sm text-slate-500">
                                  {flight.notes || "—"}
                                </div>
                              </div>

                              {/* Route */}
                              <div className="flex items-center gap-4">
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-slate-700">
                                    {(() => {
                                      const airport = formatAirportWithCity(flight.originIata);
                                      return (
                                        <div>
                                          <div>{airport.code}</div>
                                          {airport.city && <div className="text-xs text-slate-500 font-normal">{airport.city}</div>}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {formatDateTime(flight.latestEstDep || flight.latestSchedDep, iataToIana(flight.originIata))}
                                  </div>
                                </div>
                                
                                <div className="flex items-center">
                                  <div className="w-12 h-px bg-slate-300"></div>
                                  <ArrowRight className="h-4 w-4 text-slate-400 mx-2" />
                                  <div className="w-12 h-px bg-slate-300"></div>
                                </div>
                                
                                <div className="text-center">
                                  <div className="text-2xl font-bold text-slate-700">
                                    {(() => {
                                      const airport = formatAirportWithCity(flight.destIata);
                                      return (
                                        <div>
                                          <div>{airport.code}</div>
                                          {airport.city && <div className="text-xs text-slate-500 font-normal">{airport.city}</div>}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1">
                                    {formatDateTime(flight.latestEstArr || flight.latestSchedArr, iataToIana(flight.destIata))}
                                  </div>
                                </div>
                              </div>

                              {/* Terminals & Gates */}
            {(flight.latestGateDep || flight.latestGateArr || flight.latestTerminalDep || flight.latestTerminalArr) && (
                                <div className="flex items-center gap-3 text-sm text-slate-600">
                                  <MapPin className="h-4 w-4" />
                                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                                    <span>
              {`Dep: ${flight.latestGateDep ? `Gate ${flight.latestGateDep}` : (flight.latestTerminalDep ? `Terminal ${flight.latestTerminalDep}` : '—')}`}
              {flight.latestGateDep && flight.latestTerminalDep ? ` · Term ${flight.latestTerminalDep}` : ''}
                                    </span>
                                    <span className="hidden sm:inline">|</span>
                                    <span>
              {`Arr: ${flight.latestGateArr ? `Gate ${flight.latestGateArr}` : (flight.latestTerminalArr ? `Terminal ${flight.latestTerminalArr}` : '—')}`}
              {flight.latestGateArr && flight.latestTerminalArr ? ` · Term ${flight.latestTerminalArr}` : ''}
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              {/* Per-flight Refresh */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => refreshOne.mutate(flight.id)}
                                disabled={refreshOne.isPending}
                                className="h-8 w-8 p-0 text-slate-500 hover:text-slate-700 hover:bg-slate-50 transition-colors"
                                title="Refresh this flight"
                              >
                                <RefreshCw className={`h-4 w-4 ${refreshOne.isPending ? 'animate-spin' : ''}`} />
                              </Button>
                              {/* Status */}
                              {getStatusBadge(flight)}
                              
                              {/* Actions */}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteFlight(
                                  flight.id, 
                                  `${flight.carrierIata}${flight.flightNumber}`
                                )}
                                disabled={deleteMutation.isPending}
                                className="h-8 w-8 p-0 text-red-500 hover:text-red-600 hover:bg-red-50 transition-colors"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
