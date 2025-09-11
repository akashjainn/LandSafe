"use client";

import * as React from 'react';
import { percentProgress } from '@/lib/flightProgress';

interface FlightProgressProps {
  schedDep?: string | Date | null;
  estArr?: string | Date | null;
  actDep?: string | Date | null;
  actArr?: string | Date | null;
  status?: string | null;
  className?: string;
}

export function FlightProgress(props: FlightProgressProps) {
  const [value, setValue] = React.useState(0);

  React.useEffect(() => {
    const compute = () => {
      const v = percentProgress({
        scheduledDeparture: props.schedDep ?? undefined,
        estimatedArrival: props.estArr ?? undefined,
        actualDeparture: props.actDep ?? undefined,
        actualArrival: props.actArr ?? undefined,
        status: props.status ?? undefined,
      });
      setValue(v);
    };
    compute();
    const id = setInterval(compute, 60_000);
    return () => clearInterval(id);
  }, [props.schedDep, props.estArr, props.actDep, props.actArr, props.status]);

  return (
    <div className={props.className}>
      <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
        <span>Progress</span>
        <span>{value}%</span>
      </div>
      <div className="h-1.5 bg-muted rounded overflow-hidden" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-primary transition-all duration-300 ease-out" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}
