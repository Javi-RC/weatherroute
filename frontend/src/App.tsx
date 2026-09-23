import { useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import MapCanvas from "./components/map/MapCanvas";
import MapLegend from "./components/map/MapLegend";
import PlannerSheet from "./components/planner/PlannerSheet";
import type { PlannerSearch } from "./components/planner/PlannerForm";
import ResultsLayer from "./components/results/ResultsLayer";
import EmptyState from "./components/ui/EmptyState";
import { findBestRouteIndex } from "./i18n/recommendation";
import { useMediaQuery } from "./lib/useMediaQuery";
import type { GeoPoint, LngLat, MapRouteInput } from "./lib/map";
import AppShell from "./layouts/AppShell";
import { analyzeRoute } from "./services/api";
import type { AnalyzeRequest, RouteAnalysisResponse, RouteCandidate } from "./types";

type AppStatus = "idle" | "loading" | "error" | "full" | "partial";

const ERROR_MESSAGE = "No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.";

const DESKTOP_QUERY = "(min-width: 1024px)";

function toMapRouteInput(
  route: RouteCandidate,
  originLabel: string,
  destinationLabel: string,
): MapRouteInput {
  return {
    riskLevel: route.riskLevel,
    distanceKm: route.distanceKm,
    durationMinutes: route.durationMinutes,
    score: route.riskScore,
    originLabel,
    destinationLabel,
    geometry: {
      type: "LineString",
      coordinates: route.polyline.map(
        (point): LngLat => [point.longitude, point.latitude],
      ),
    },
  };
}

export default function App() {
  const [status, setStatus] = useState<AppStatus>("idle");
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);
  const [last, setLast] = useState<AnalyzeRequest | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [expandedRouteId, setExpandedRouteId] = useState<number | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [originPoint, setOriginPoint] = useState<GeoPoint | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<GeoPoint | null>(null);

  const isCompact = !useMediaQuery(DESKTOP_QUERY);

  const mutation = useMutation({
    mutationFn: analyzeRoute,
    onSuccess: (data) => {
      setResult(data);
      setStatus(data.status);
      setSelectedRouteId(data.routes.length > 0 ? findBestRouteIndex(data.routes) : null);
    },
    onError: () => setStatus("error"),
  });

  const routeCount = result?.routes.length ?? 0;
  useEffect(() => {
    setExpandedRouteId((current) => (current === null || current < routeCount ? current : null));
  }, [routeCount]);

  const mapRoutes = useMemo<MapRouteInput[]>(() => {
    if (!result) return [];
    return result.routes.map((route) => toMapRouteInput(route, originLabel, destinationLabel));
  }, [result, originLabel, destinationLabel]);

  function handleSearch(search: PlannerSearch) {
    const request: AnalyzeRequest = {
      origin: search.origin,
      destination: search.destination,
      activity: search.activity,
      departureTime: search.departureTime,
      maxDurationMinutes: search.maxDurationMinutes,
    };
    setLast(request);
    setOriginLabel(search.origin);
    setDestinationLabel(search.destination);
    setOriginPoint(search.originPoint);
    setDestinationPoint(search.destinationPoint);
    setSelectedRouteId(null);
    setExpandedRouteId(null);
    setStatus("loading");
    try {
      mutation.mutate(request);
    } catch {
      setStatus("error");
    }
  }

  function handleRetry() {
    if (!last) return;
    setSelectedRouteId(null);
    setExpandedRouteId(null);
    setStatus("loading");
    try {
      mutation.mutate(last);
    } catch {
      setStatus("error");
    }
  }

  function handleNewSearch() {
    setResult(null);
    setLast(null);
    setOriginLabel("");
    setDestinationLabel("");
    setOriginPoint(null);
    setDestinationPoint(null);
    setSelectedRouteId(null);
    setExpandedRouteId(null);
    setStatus("idle");
  }

  function handleToggleExpand(index: number) {
    setExpandedRouteId((current) => (current === index ? null : index));
  }

  return (
    <AppShell
      isCompact={isCompact}
      plannerSlot={<PlannerSheet busy={status === "loading"} onSearch={handleSearch} isCompact={isCompact} />}
      resultsSlot={
        <ResultsLayer
          viewState={status}
          routes={result?.routes ?? []}
          weatherAvailable={result?.weatherAvailable ?? true}
          routeAvailable={result?.routeAvailable ?? true}
          selectedRouteId={selectedRouteId}
          expandedRouteId={expandedRouteId}
          onSelectRoute={setSelectedRouteId}
          onToggleExpand={handleToggleExpand}
          onCloseDetail={() => setExpandedRouteId(null)}
          onRetry={handleRetry}
          onNewSearch={handleNewSearch}
          error={status === "error" ? ERROR_MESSAGE : null}
        />
      }
      welcomeSlot={
        status === "idle" ? (
          <EmptyState
            title="Tu ruta, con el clima en cuenta"
            description="Introduce el origen y el destino, elige tu actividad y compara las rutas según la previsión meteorológica."
          />
        ) : undefined
      }
      legendSlot={<MapLegend />}
    >
      <MapCanvas
        routes={mapRoutes}
        selectedRouteId={selectedRouteId}
        onSelectRoute={setSelectedRouteId}
        originPoint={originPoint ?? undefined}
        destinationPoint={destinationPoint ?? undefined}
        isCompact={isCompact}
      />
    </AppShell>
  );
}