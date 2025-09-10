// Demo page rendering mock flights with progress & status UI.
"use client";
import React, { useEffect } from "react";
import { useFlightStore } from "@/lib/realtime/store/useFlightStore";
import { MockAdapter } from "@/lib/realtime/adapters/MockAdapter";
import { FlightRow } from "@/components/FlightRow";

export default function DemoProgressPage() {
  const { order, flights, setAdapter } = useFlightStore();
  useEffect(() => {
    const adapter = new MockAdapter();
    setAdapter(adapter as any);
    return () => { /* adapter cleanup handled in store */ };
  }, [setAdapter]);

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-lg font-semibold">Flight Progress Demo</h1>
      <div className="border rounded-md divide-y">
  {order.map((id: string) => <FlightRow key={id} flight={flights[id]} />)}
      </div>
      <p className="text-xs text-slate-500">Includes scheduled, departed (no position), enroute, approach, landed, diverted, cancelled examples.</p>
    </div>
  );
}
