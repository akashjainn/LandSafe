"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
        // make sure it's above everything
        className="sm:max-w-[520px] z-[1000]"
        onClick={(e) => e.stopPropagation()} // belt & suspenders
      >
        <DialogHeader>
          <DialogTitle>Delete Flight</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete flight {flight.airline}{flight.number}?
          </DialogDescription>
        </DialogHeader>

        <div className="text-sm space-y-2 py-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Route:</span>
            <span>{flight.from} → {flight.to}</span>
          </div>
          {flight.pax && (
            <div className="flex items-center gap-2">
              <span className="font-medium">Passenger:</span>
              <span>{flight.pax}</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button 
              variant="outline" 
              type="button" 
              onClick={(e) => e.stopPropagation()}
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
          >
            Delete Flight
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
