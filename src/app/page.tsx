"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyFlights } from "@/components/empty-state";
import { useFlights } from "@/hooks/useFlights";
import { Plane, Clock, TrendingUp, Eye, Plus } from "lucide-react";
import { iataToIana } from "@/lib/airports";
import { displayFlightIata } from "@/lib/airlineCodes";
import { format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";

export default function DashboardPage() {
  const { data: flights = [], isLoading } = useFlights();

  // Helpers for delay and formatting
  const toDate = (d?: Date | string | null) => (typeof d === 'string' ? new Date(d) : d) as Date | undefined;
  const computeDelayMinutes = (sched?: Date | string | null, est?: Date | string | null, act?: Date | string | null): number | null => {
    const s = toDate(sched);
    const e = toDate(est);
    const a = toDate(act);
    const ref = a || e;
    if (!s || !ref) return null;
    return Math.round((ref.getTime() - s.getTime()) / 60000);
  };
  const fmtLocal = (date?: Date | string | null, tz?: string) => {
    if (!date) return "—";
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return tz ? formatInTimeZone(d, tz, "EEE, MMM d, h:mm a") : format(d, "EEE, MMM d, h:mm a");
    } catch {
      return "—";
    }
  };

  // Calculate KPIs based on delays
  const totalFlights = flights.length;
  const delays = flights.map(f => {
    const arrDelta = computeDelayMinutes(f.latestSchedArr, f.latestEstArr, null);
    const depDelta = computeDelayMinutes(f.latestSchedDep, f.latestEstDep, null);
    return arrDelta !== null ? arrDelta : depDelta;
  }).filter((v): v is number => v !== null);
  const onTimeFlights = delays.filter(min => min <= 0).length;
  const onTimePercentage = totalFlights > 0 ? Math.round((onTimeFlights / totalFlights) * 100) : 0;
  const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + Math.max(0, b), 0) / delays.length) : null;

  // Show flights sorted by upcoming departure (est or sched), not by createdAt
  const recentFlights = [...flights]
    .sort((a, b) => {
      const aTime = toDate(a.latestEstDep) || toDate(a.latestSchedDep) || new Date(0);
      const bTime = toDate(b.latestEstDep) || toDate(b.latestSchedDep) || new Date(0);
      return aTime.getTime() - bTime.getTime();
    })
    .slice(0, 10);

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="pb-2">
                <div className="h-4 bg-slate-200 rounded w-20"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-slate-200 rounded w-16"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Overview of your tracked flights</p>
        </div>
        <Button asChild>
          <a href="/upload">
            <Plus className="h-4 w-4 mr-2" />
            Add Flight
          </a>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Flights Tracked Today</CardTitle>
            <Plane className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFlights}</div>
            <p className="text-xs text-slate-600">
              Active monitoring
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">On-time Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{onTimePercentage}%</div>
            <p className="text-xs text-slate-600">
              {onTimeFlights} of {totalFlights} flights
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Delay</CardTitle>
            <Clock className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{avgDelay !== null ? `${avgDelay}m` : '—'}</div>
            <p className="text-xs text-slate-600">
              Minutes behind schedule
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Currently Watching</CardTitle>
            <Eye className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalFlights}</div>
            <p className="text-xs text-slate-600">
              Active flights
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      {totalFlights === 0 ? (
        <EmptyFlights />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Latest flight updates and status changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentFlights.map((flight) => {
                  const depTz = iataToIana(flight.originIata);
                  const arrTz = iataToIana(flight.destIata);
                  return (
                    <div key={flight.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0">
                      <div>
                        <div className="font-medium text-sm">{displayFlightIata(flight.carrierIata, flight.flightNumber)}</div>
                        <div className="text-xs text-slate-600">
                          {flight.originIata} → {flight.destIata}
                        </div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <div>Dep: {fmtLocal(flight.latestEstDep || flight.latestSchedDep, depTz)}</div>
                        <div>Arr: {fmtLocal(flight.latestEstArr || flight.latestSchedArr, arrTz)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick Add Flight</CardTitle>
              <CardDescription>
                Track a new flight quickly
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-slate-600">
                  Add flights to start monitoring their status in real-time.
                </p>
                <div className="flex gap-2">
                  <Button asChild><a href="/upload">Add Flight</a></Button>
                  <Button asChild variant="outline"><a href="/upload">Import CSV</a></Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
