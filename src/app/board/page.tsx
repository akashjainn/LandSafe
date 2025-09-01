"use client";

import { useState } from "react";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { iataToIana } from "@/lib/airports";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Calendar, 
  RefreshCw, 
  Upload, 
  Plane,
  MapPin,
  Search,
  Filter,
  Trash2
} from "lucide-react";
import { useFlights, useRefreshAllFlights, useDeleteFlight } from "@/hooks/useFlights";
import { getStatusColor, getStatusLabel, FlightStatusCode } from "@/lib/types";

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

  const handleRefresh = () => {
    refreshMutation.mutate(Object.keys(filters).length > 0 ? filters : undefined);
  };

  const handleDeleteFlight = async (flightId: string, flightDetails: string) => {
    if (confirm(`Are you sure you want to delete flight ${flightDetails}? This action cannot be undone.`)) {
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

  const tzFor = (iata?: string | null) => iataToIana(iata);

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

  const getStatusBadge = (status?: FlightStatusCode) => {
    if (!status) return null;
    
    const color = getStatusColor(status);
    const label = getStatusLabel(status);
    
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
      <Badge variant={variants[color] || "outline"} className={`bg-${color}-100 text-${color}-800 hover:bg-${color}-200`}>
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
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">Error loading flights</div>
        <Button onClick={() => window.location.reload()}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Flight Board</h1>
          <p className="text-gray-600 mt-1">Real-time flight tracking for your reunion</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshMutation.isPending}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh All
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a href="/upload">
              <Upload className="h-4 w-4 mr-2" />
              Add Flights
            </a>
          </Button>
        </div>
      </div>

      {/* Search and Filter Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Search flights..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-gray-500" />
              <Input
                placeholder="Year (e.g., 2025)"
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Input
                placeholder="Month (1-12)"
                value={monthFilter}
                onChange={(e) => setMonthFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Input
                placeholder="Day (1-31)"
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                className="w-full"
              />
            </div>
            <div>
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Clear Filters
              </Button>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-500">
            {flights.length} flight{flights.length !== 1 ? 's' : ''} found
          </div>
        </CardContent>
      </Card>

      {/* Flights by Date */}
      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-500">Loading flights...</div>
          </CardContent>
        </Card>
      ) : sortedDates.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No flights found</p>
              <Button variant="outline" asChild>
                <a href="/upload">Add Your First Flight</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {sortedDates.map((dateKey) => (
            <Card key={dateKey}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                  </div>
                  <Badge variant="outline">
                    {flightsByDate[dateKey].length} flight{flightsByDate[dateKey].length !== 1 ? 's' : ''}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Flight</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Route</TableHead>
                        <TableHead>Departure</TableHead>
                        <TableHead>Arrival</TableHead>
                        <TableHead>Gates</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-16">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flightsByDate[dateKey].map((flight) => (
                        <TableRow key={flight.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="font-medium">
                              {flight.carrierIata}{flight.flightNumber}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {flight.notes || "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="font-mono">{flight.originIata || "—"}</span>
                              <Plane className="h-3 w-3 text-gray-400" />
                              <span className="font-mono">{flight.destIata || "—"}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="text-gray-500">Scheduled:</span> {formatDateTime(flight.latestSchedDep || flight.latestEstDep, tzFor(flight.originIata))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="text-sm">
                                <span className="text-gray-500">Scheduled:</span> {formatDateTime(flight.latestSchedArr || flight.latestEstArr, tzFor(flight.destIata))}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-sm">
                              {flight.latestGateDep && (
                                <div className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  {flight.latestGateDep}
                                </div>
                              )}
                              {flight.latestGateArr && (
                                <div className="flex items-center gap-1 text-gray-600">
                                  <MapPin className="h-3 w-3 text-gray-400" />
                                  {flight.latestGateArr}
                                </div>
                              )}
                              {!flight.latestGateDep && !flight.latestGateArr && "—"}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(flight.latestStatus)}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteFlight(
                                flight.id, 
                                `${flight.carrierIata}${flight.flightNumber}`
                              )}
                              disabled={deleteMutation.isPending}
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
