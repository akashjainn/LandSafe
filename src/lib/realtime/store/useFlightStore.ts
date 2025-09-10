// useFlightStore.ts - Zustand store managing real-time flights and adapters.
import { create } from "zustand";
import { Flight } from "../geo";
import { computeProgress } from "../progress";
import { deriveStatus } from "../status";

export interface FlightAdapter {
  subscribe(onFlights: (flights: Flight[]) => void): () => void; // returns unsubscribe
  // optional manual refresh
  refresh?(): Promise<void>;
}

interface FlightState {
  flights: Record<string, Flight>;
  order: string[]; // maintain stable ordering
  upsertFlights: (incoming: Flight[]) => void;
  setAdapter: (adapter: FlightAdapter) => void;
  adapter?: FlightAdapter;
}

export const useFlightStore = create<FlightState>((set, get) => ({
  flights: {},
  order: [],
  adapter: undefined,
  upsertFlights: (incoming: Flight[]) => {
    set((state: FlightState) => {
      const nextFlights = { ...state.flights };
      const order = [...state.order];
      for (const f of incoming) {
        const progress = computeProgress(f);
        f.progress = progress;
        f.status_code = deriveStatus(f, progress);
        if (!nextFlights[f.id]) order.push(f.id);
        nextFlights[f.id] = { ...nextFlights[f.id], ...f };
      }
      return { flights: nextFlights, order };
    });
  },
  setAdapter: (adapter: FlightAdapter) => {
    const prev = get().adapter;
  // @ts-expect-error internal detach metadata
  if (prev && prev.__unsub) prev.__unsub();
  const unsub = adapter.subscribe((flights: Flight[]) => get().upsertFlights(flights));
  // @ts-expect-error attach internal metadata
  adapter.__unsub = unsub;
    set({ adapter });
  },
}));
