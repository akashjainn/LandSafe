"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  MapPin
} from "lucide-react";
import { useFlights, useRefreshAllFlights } from "@/hooks/useFlights";
import { getStatusColor, getStatusLabel, FlightStatusCode } from "@/lib/types";

export default function BoardPage() {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const { data: flights = [], isLoading, error } = useFlights(selectedDate);
  const refreshMutation = useRefreshAllFlights();

  const handleRefresh = () => {
    refreshMutation.mutate(selectedDate);
  };

  const formatTime = (date?: Date | string | null) => {
    if (!date) return "—";
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, "h:mm a");
    } catch {
      return "—";
    }
  };

  const formatDate = (date?: Date | string | null) => {
    if (!date) return "—";
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;
      return format(dateObj, "MMM d");
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

  const sortedFlights = flights.sort((a, b) => {
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

      {/* Date Selector */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Calendar className="h-5 w-5 text-gray-500" />
            <label htmlFor="date" className="text-sm font-medium text-gray-700">
              Select Date:
            </label>
            <input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <div className="text-sm text-gray-500">
              {flights.length} flight{flights.length !== 1 ? 's' : ''} tracked
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Flights Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plane className="h-5 w-5" />
            Flights for {formatDate(selectedDate)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-gray-500">Loading flights...</div>
          ) : sortedFlights.length === 0 ? (
            <div className="text-center py-8">
              <Plane className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">No flights found for {formatDate(selectedDate)}</p>
              <Button variant="outline" asChild>
                <a href="/upload">Add Your First Flight</a>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Flight</TableHead>
                    <TableHead>Friend</TableHead>
                    <TableHead>Route</TableHead>
                    <TableHead>Departure</TableHead>
                    <TableHead>Arrival</TableHead>
                    <TableHead>Gates</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedFlights.map((flight) => (
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
                            <span className="text-gray-500">Sched:</span> {formatTime(flight.latestSchedDep)}
                          </div>
                          {flight.latestEstDep && (
                            <div className="text-sm">
                              <span className="text-gray-500">Est:</span> {formatTime(flight.latestEstDep)}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="text-sm">
                            <span className="text-gray-500">Sched:</span> {formatTime(flight.latestSchedArr)}
                          </div>
                          {flight.latestEstArr && (
                            <div className="text-sm">
                              <span className="text-gray-500">Est:</span> {formatTime(flight.latestEstArr)}
                            </div>
                          )}
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
                        </div>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(flight.latestStatus)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
