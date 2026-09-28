import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityType, GeoCoordinates } from "../types";

export interface UrlState {
  origin: GeoCoordinates | null;
  originLabel: string;
  destination: GeoCoordinates | null;
  destinationLabel: string;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes: number | null;
  selectedRouteIndex: number | null;
}

export const DEFAULT_ACTIVITY: ActivityType = "Cycling";

const ACTIVITIES: readonly ActivityType[] = [
  "Walking",
  "Running",
  "Cycling",
  "Motorcycle",
  "Driving",
];

export const DEFAULT_STATE: UrlState = {
  origin: null,
  originLabel: "",
  destination: null,
  destinationLabel: "",
  activity: DEFAULT_ACTIVITY,
  departureTime: "",
  maxDurationMinutes: null,
  selectedRouteIndex: null,
};

export function parseCoordinates(value: string | null): GeoCoordinates | null {
  if (!value) return null;
  const [rawLat, rawLon, ...rest] = value.split(",");
  if (rawLat === undefined || rawLon === undefined || rest.length > 0) return null;
  const latitude = Number(rawLat);
  const longitude = Number(rawLon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseIndex(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function readState(): UrlState {
  const query = new URLSearchParams(window.location.search);
  const activity = query.get("a");
  const max = query.get("max");
  const parsedMax = max === null ? null : Number(max);
  return {
    origin: parseCoordinates(query.get("o")),
    originLabel: query.get("ol") ?? "",
    destination: parseCoordinates(query.get("d")),
    destinationLabel: query.get("dl") ?? "",
    activity:
      activity !== null && ACTIVITIES.includes(activity as ActivityType)
        ? (activity as ActivityType)
        : DEFAULT_ACTIVITY,
    departureTime: query.get("t") ?? "",
    maxDurationMinutes:
      parsedMax !== null && Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : null,
    selectedRouteIndex: parseIndex(query.get("r")),
  };
}

function writeState(state: UrlState): void {
  const query = new URLSearchParams();
  if (state.origin) query.set("o", `${state.origin.latitude},${state.origin.longitude}`);
  if (state.originLabel) query.set("ol", state.originLabel);
  if (state.destination) query.set("d", `${state.destination.latitude},${state.destination.longitude}`);
  if (state.destinationLabel) query.set("dl", state.destinationLabel);
  if (state.activity !== DEFAULT_ACTIVITY) query.set("a", state.activity);
  if (state.departureTime) query.set("t", state.departureTime);
  if (state.maxDurationMinutes !== null) query.set("max", String(state.maxDurationMinutes));
  if (state.selectedRouteIndex !== null) query.set("r", String(state.selectedRouteIndex));
  const search = query.toString();
  window.history.replaceState(null, "", search ? `/?${search}` : "/");
}

export function useUrlState(): { state: UrlState; update: (patch: Partial<UrlState>) => void } {
  const [state, setState] = useState<UrlState>(readState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onPopState = () => {
      const next = readState();
      stateRef.current = next;
      setState(next);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const update = useCallback((patch: Partial<UrlState>) => {
    const next = { ...stateRef.current, ...patch };
    stateRef.current = next;
    writeState(next);
    setState(next);
  }, []);

  return { state, update };
}
