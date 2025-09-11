"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plane, AlertTriangle } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  flight: { 
    number: string; 
    airline: string;
    from: string; 
    to: string; 
    pax?: string;
  };
  onConfirm: () => void;
};

export function DeleteFlightDialog({ open, onOpenChange, flight, onConfirm }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* Radix portals to <body>, so no bubbling to the card */}
      <DialogContent
        className="sm:max-w-md z-[1000] bg-white border-0 shadow-xl rounded-2xl p-0 overflow-hidden"
        onClick={(e) => e.stopPropagation()} // belt & suspenders
        data-dialog // marker for parent click handlers to ignore
      >
        {/* Header with gradient background matching app style */}
        <div className="bg-gradient-to-r from-red-600 via-red-700 to-red-800 text-white p-6">
          <DialogHeader className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <DialogTitle className="text-xl font-bold text-white">Delete Flight</DialogTitle>
            </div>
            <DialogDescription className="text-red-100 text-base leading-relaxed">
              Are you sure you want to delete this flight? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content area with flight details */}
        <div className="p-6 space-y-6">
          {/* Flight summary card */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50/30 rounded-xl border border-slate-200 p-4">
            <div className="flex items-center gap-3 mb-3">
              <Plane className="w-5 h-5 text-slate-600" />
              <div className="font-bold text-lg text-slate-900">
                {flight.airline}{flight.number}
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-600 w-16">Route:</span>
                <span className="text-sm font-semibold text-slate-900">
                  {flight.from} → {flight.to}
                </span>
              </div>
              {flight.pax && (
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-600 w-16">Passenger:</span>
                  <span className="text-sm text-slate-700">{flight.pax}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer with actions */}
        <DialogFooter className="px-6 pb-6 flex-col sm:flex-row gap-3 sm:gap-2">
          <DialogClose asChild>
            <Button 
              variant="outline" 
              type="button" 
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:w-auto border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            type="button"
            onClick={(e) => { 
              e.stopPropagation(); 
              onConfirm(); 
              onOpenChange(false); 
            }}
            className="w-full sm:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 border-0 shadow-lg transition-all duration-200"
          >
            Delete Flight
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
