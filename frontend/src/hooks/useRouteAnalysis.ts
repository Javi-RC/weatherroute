import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { PlannerSearch } from "../components/planner/PlannerForm";
import type { GeoPoint } from "../lib/map";
import type { NewHistoryEntry } from "../lib/storage";
import { analyzeRoute } from "../services/api";
import type { AnalyzeRequest, RouteAnalysisResponse } from "../types";
import { useDebouncedCallback } from "./useDebouncedCallback";

export type RouteAnalysisStatus = "idle" | "loading" | "error" | "full" | "partial";

export interface RouteRunPlaces {
  originLabel: string;
  destinationLabel: string;
  originPoint: GeoPoint | null;
  destinationPoint: GeoPoint | null;
}

export interface RouteAnalysisEffects {
  saveToHistory: (entry: NewHistoryEntry) => void;
  notifyRefreshError: () => void;
  notifyPartial: (result: RouteAnalysisResponse) => void;
  selectBestRoute: (result: RouteAnalysisResponse) => void;
}

export interface RouteAnalysisController {
  status: RouteAnalysisStatus;
  result: RouteAnalysisResponse | null;
  refreshing: boolean;
  runAnalysis(search: PlannerSearch, places: RouteRunPlaces): boolean;
  retry(): void;
  reset(): void;
}

export function useRouteAnalysis(effects: RouteAnalysisEffects): RouteAnalysisController {
  const [status, setStatus] = useState<RouteAnalysisStatus>("idle");
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const refreshRequestRef = useRef<AnalyzeRequest | null>(null);
  const intentRef = useRef<{ request: AnalyzeRequest; isRefresh: boolean } | null>(null);
  const lastRef = useRef<AnalyzeRequest | null>(null);
  const effectsRef = useRef(effects);

  useEffect(() => {
    effectsRef.current = effects;
  }, [effects]);

  const mutation = useMutation({
    mutationFn: analyzeRoute,
    onSuccess: (data, variables) => {
      const intent = intentRef.current;
      if (!intent || intent.request !== variables) return;
      if (intent.request.origin && intent.request.destination) {
        effectsRef.current.saveToHistory({
          origin: intent.request.origin,
          destination: intent.request.destination,
          activity: intent.request.activity,
          departureTimeUtc: intent.request.departureTime,
          maxDurationMinutes: intent.request.maxDurationMinutes ?? null,
        });
      }
      setResult(data);
      setStatus(data.status);
      if (data.status === "partial") effectsRef.current.notifyPartial(data);
      if (!intent.isRefresh) effectsRef.current.selectBestRoute(data);
      setRefreshing(false);
    },
    onError: (_error, variables) => {
      const intent = intentRef.current;
      if (!intent || intent.request !== variables) return;
      if (intent.isRefresh) {
        setRefreshing(false);
        effectsRef.current.notifyRefreshError();
        return;
      }
      setStatus("error");
    },
  });

  const scheduleRefresh = useDebouncedCallback(() => {
    const request = refreshRequestRef.current;
    refreshRequestRef.current = null;
    if (request === null || refreshing || status === "loading" || mutation.isPending) return;
    intentRef.current = { request, isRefresh: true };
    setRefreshing(true);
    try {
      mutation.mutate(request);
    } catch {
      setRefreshing(false);
      effectsRef.current.notifyRefreshError();
    }
  });

  function runAnalysis(search: PlannerSearch, places: RouteRunPlaces): boolean {
    const request: AnalyzeRequest = {
      origin: search.origin,
      destination: search.destination,
      originCoordinates: places.originPoint,
      destinationCoordinates: places.destinationPoint,
      activity: search.activity,
      departureTime: search.departureTime,
      maxDurationMinutes: search.maxDurationMinutes,
    };

    const samePlaces =
      (status === "full" || status === "partial") &&
      search.origin === places.originLabel &&
      search.destination === places.destinationLabel &&
      places.originPoint !== null &&
      places.destinationPoint !== null &&
      search.originPoint.latitude === places.originPoint.latitude &&
      search.originPoint.longitude === places.originPoint.longitude &&
      search.destinationPoint.latitude === places.destinationPoint.latitude &&
      search.destinationPoint.longitude === places.destinationPoint.longitude;

    if (samePlaces) {
      const last = lastRef.current;
      const unchanged =
        last !== null &&
        request.activity === last.activity &&
        request.departureTime === last.departureTime &&
        request.maxDurationMinutes === last.maxDurationMinutes;
      if (!unchanged) {
        refreshRequestRef.current = request;
        lastRef.current = request;
        scheduleRefresh();
      }
      return false;
    }

    intentRef.current = { request, isRefresh: false };
    refreshRequestRef.current = null;
    setRefreshing(false);
    lastRef.current = request;
    setStatus("loading");
    try {
      mutation.mutate(request);
    } catch {
      setStatus("error");
    }
    return true;
  }

  function retry() {
    const last = lastRef.current;
    if (!last) return;
    intentRef.current = { request: last, isRefresh: false };
    refreshRequestRef.current = null;
    setRefreshing(false);
    setStatus("loading");
    try {
      mutation.mutate(last);
    } catch {
      setStatus("error");
    }
  }

  function reset() {
    intentRef.current = null;
    refreshRequestRef.current = null;
    lastRef.current = null;
    setRefreshing(false);
    setResult(null);
    setStatus("idle");
  }

  return { status, result, refreshing, runAnalysis, retry, reset };
}