"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Flight, ApiResponse, BulkRefreshResult } from "@/lib/types";

// API functions
async function fetchFlights(filters?: {
  date?: string;
  year?: string;
  month?: string;
  day?: string;
}): Promise<Flight[]> {
  const params = new URLSearchParams();
  if (filters?.date) params.append('date', filters.date);
  if (filters?.year) params.append('year', filters.year);
  if (filters?.month) params.append('month', filters.month);
  if (filters?.day) params.append('day', filters.day);
  
  const queryString = params.toString();
  const url = queryString ? `/api/flights?${queryString}` : '/api/flights';
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch flights");
  }
  const result: ApiResponse<Flight[]> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to fetch flights");
  }
  return result.data;
}

async function refreshFlight(flightId: string) {
  const response = await fetch(`/api/refresh/${flightId}`, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to refresh flight");
  }
  return response.json();
}

async function refreshAllFlights(url: string): Promise<BulkRefreshResult> {
  const response = await fetch(url, {
    method: "POST",
  });
  if (!response.ok) {
    throw new Error("Failed to refresh flights");
  }
  const result: ApiResponse<BulkRefreshResult> = await response.json();
  if (!result.success || !result.data) {
    throw new Error(result.error || "Failed to refresh flights");
  }
  return result.data;
}

async function createFlight(flightData: Partial<Flight>) {
  const response = await fetch("/api/flights", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(flightData),
  });
  if (!response.ok) {
    throw new Error("Failed to create flight");
  }
  return response.json();
}

async function batchCreateFlights(flights: Partial<Flight>[]) {
  const response = await fetch("/api/flights/batch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ flights }),
  });
  if (!response.ok) {
    throw new Error("Failed to create flights");
  }
  return response.json();
}

// Custom hooks
export function useFlights(filters?: {
  date?: string;
  year?: string;
  month?: string;
  day?: string;
}) {
  return useQuery({
    queryKey: ["flights", filters],
    queryFn: () => fetchFlights(filters),
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useRefreshFlight() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: refreshFlight,
    onSuccess: () => {
      // Invalidate and refetch flights
      queryClient.invalidateQueries({ queryKey: ["flights"] });
    },
  });
}

export function useRefreshAllFlights() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (filters?: {
      date?: string;
      year?: string;
      month?: string;
      day?: string;
    }) => {
      const params = new URLSearchParams();
      if (filters?.date) params.append('date', filters.date);
      if (filters?.year) params.append('year', filters.year);
      if (filters?.month) params.append('month', filters.month);
      if (filters?.day) params.append('day', filters.day);
      
      const queryString = params.toString();
      const url = queryString ? `/api/refresh/bulk?${queryString}` : '/api/refresh/bulk';
      
      return refreshAllFlights(url);
    },
    onSuccess: () => {
      // Invalidate and refetch flights
      queryClient.invalidateQueries({ queryKey: ["flights"] });
    },
  });
}

export function useCreateFlight() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: createFlight,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
    },
  });
}

export function useBatchCreateFlights() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: batchCreateFlights,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flights"] });
    },
  });
}
