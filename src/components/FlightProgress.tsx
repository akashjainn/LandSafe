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
      <div className="flex items-center gap-2 min-w-0 w-full max-w-[520px]" aria-label="Flight progress row">
        <span className="text-xs text-muted-foreground shrink-0">Progress</span>
        <div
          className="relative h-2 grow rounded-full bg-muted overflow-hidden"
          role="progressbar"
          aria-valuenow={value}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Flight progress percentage"
        >
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-300 ease-out"
            style={{ width: `${value}%` }}
          />
        </div>
        <span className="text-xs tabular-nums shrink-0 w-10 text-right">{value}%</span>
      </div>
    </div>
  );
}
