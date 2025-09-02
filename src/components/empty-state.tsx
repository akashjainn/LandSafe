import { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  title: string;
  description: string | ReactNode;
  actions?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ 
  title, 
  description, 
  actions, 
  icon, 
  className 
}: EmptyStateProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center rounded-2xl border bg-white p-10 text-center",
      className
    )}>
      {icon && (
        <div className="mb-4 text-slate-400">
          {icon}
        </div>
      )}
      <div className="mb-3 text-lg font-semibold text-slate-900">{title}</div>
      <div className="max-w-md text-slate-600">
        {description}
      </div>
      {actions && (
        <div className="mt-6 flex gap-2">
          {actions}
        </div>
      )}
    </div>
  );
}

export function EmptyFlights() {
  return (
    <EmptyState
      title="No flights yet"
      description={
        <>
          Add a flight number and date (e.g., <code className="font-mono text-sm bg-slate-100 px-1 py-0.5 rounded">WN300</code> on <code className="font-mono text-sm bg-slate-100 px-1 py-0.5 rounded">2025-09-01</code>) to start tracking. You can also import a CSV.
        </>
      }
      actions={
        <>
          <Button asChild><a href="/upload">Add Flight</a></Button>
          <Button asChild variant="outline"><a href="/upload">Import CSV</a></Button>
        </>
      }
    />
  );
}
