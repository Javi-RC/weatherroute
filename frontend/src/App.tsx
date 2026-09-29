import { useEffect, useMemo, useRef, useState } from "react";
import AboutModal, { type AboutSection } from "./components/about/AboutModal";
import Header from "./components/Header";
import HistorySheet from "./components/history/HistorySheet";
import MapCanvas, { type MapCanvasHandle, type PickMode } from "./components/map/MapCanvas";
import MapControlBar from "./components/map/MapControlBar";
import PickModeBar from "./components/map/PickModeBar";
import RouteDetailCard from "./components/map/RouteDetailCard";
import PlannerSheet from "./components/planner/PlannerSheet";
import { ACTIVITY_LABELS } from "./components/planner/ActivityPicker";
import type { PlannerSearch } from "./components/planner/PlannerForm";
import RefreshingIndicator from "./components/results/RefreshingIndicator";
import ResultsLayer from "./components/results/ResultsLayer";
import EmptyState from "./components/ui/EmptyState";
import LiveRegion from "./components/ui/LiveRegion";
import { findBestRouteIndex } from "./i18n/recommendation";
import { useIsDesktop } from "./lib/breakpoints";
import { resolvePlace } from "./lib/places";
import type { GeoPoint, LngLat, MapRouteInput } from "./lib/map";
import { useRecentSearches } from "./hooks/useRecentSearches";
import { useRouteAnalysis } from "./hooks/useRouteAnalysis";
import { useUrlState } from "./hooks/useUrlState";
import type { HistoryEntry } from "./lib/storage";
import AppShell from "./layouts/AppShell";
import { useDebouncedCallback } from "./hooks/useDebouncedCallback";
import { ToastProvider, useToasts } from "./hooks/useToasts";
import { reverseGeocode } from "./services/api";
import type { RouteCandidate, ActivityType } from "./types";

const ERROR_MESSAGE = "No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.";
const REFRESH_ERROR_MESSAGE = "No se pudo actualizar la ruta. Se conservan los resultados anteriores.";
const WEATHER_UNAVAILABLE_TOAST = "No hay previsión meteorológica para esa fecha. Mostramos distancia y duración.";
const ROUTE_UNAVAILABLE_TOAST = "No se pudo calcular una ruta entre esos puntos. Prueba a elegir otros puntos o a cambiar de actividad.";
const LOCATION_ERROR_MESSAGE = "No pudimos obtener tu ubicación. Revisa los permisos del navegador.";

function toMapRouteInput(
  route: RouteCandidate,
  originLabel: string,
  destinationLabel: string,
  selected: boolean,
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
    selected,
  };
}

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

function AppContent() {
  const { addToast } = useToasts();
  const history = useRecentSearches();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [aboutSection, setAboutSection] = useState<AboutSection | null>(null);
  const [selectedRouteId, setSelectedRouteId] = useState<number | null>(null);
  const [originLabel, setOriginLabel] = useState("");
  const [destinationLabel, setDestinationLabel] = useState("");
  const [originPoint, setOriginPoint] = useState<GeoPoint | null>(null);
  const [destinationPoint, setDestinationPoint] = useState<GeoPoint | null>(null);
  const [activity, setActivity] = useState<ActivityType>("Driving");

  const { state: url, update: updateUrl } = useUrlState();
  const isCompact = !useIsDesktop();
  const mapRef = useRef<MapCanvasHandle | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(originPoint ? "destination" : "origin");
  const [hoveredRouteId, setHoveredRouteId] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
  const restoredRef = useRef(false);
  const [announcement, setAnnouncement] = useState<string | null>(null);

  const analysis = useRouteAnalysis({
    saveToHistory: history.save,
    notifyRefreshError: () => addToast("error", REFRESH_ERROR_MESSAGE),
    notifyPartial: (data) => {
      if (!data.routeAvailable) addToast("info", ROUTE_UNAVAILABLE_TOAST);
      else if (!data.weatherAvailable) addToast("info", WEATHER_UNAVAILABLE_TOAST);
    },
    selectBestRoute: (data) => {
      setSelectedRouteId(data.routes.length > 0 ? findBestRouteIndex(data.routes) : null);
    },
  });
  const { result, status, refreshing } = analysis;

  const mapRoutes = useMemo<MapRouteInput[]>(() => {
    if (!result) return [];
    return result.routes.map((route, index) =>
      toMapRouteInput(route, originLabel, destinationLabel, index === selectedRouteId),
    );
  }, [result, originLabel, destinationLabel, selectedRouteId]);

  function handleSearch(search: PlannerSearch) {
    const fired = analysis.runAnalysis(search, {
      originLabel,
      destinationLabel,
      originPoint,
      destinationPoint,
    });
    if (!fired) return;
    setOriginLabel(search.origin);
    setDestinationLabel(search.destination);
    setOriginPoint(search.originPoint);
    setDestinationPoint(search.destinationPoint);
    setActivity(search.activity);
    setSelectedRouteId(null);
    setRunId((current) => current + 1);
  }

  useEffect(() => {
    if (runId === 0) return;
    mapRef.current?.fitToRoutes();
  }, [runId, result]);

  function handleSelectRoute(index: number) {
    setSelectedRouteId(index);
    setAnnouncement(`Ruta ${index + 1} seleccionada`);
    updateUrl({ selectedRouteIndex: index });
  }

  const selectedRoute = result?.routes.find((_route, index) => index === selectedRouteId) ?? null;
  const probePoint = useMemo(() => {
    const segment = selectedRoute?.segments[hoveredSegment ?? -1];
    if (!segment || !selectedRoute) return null;
    const vertex = selectedRoute.polyline[segment.fromIndex];
    return vertex ? { latitude: vertex.latitude, longitude: vertex.longitude } : null;
  }, [selectedRoute, hoveredSegment]);

  const syncCamera = useDebouncedCallback(
    (center: { lng: number; lat: number }, zoom: number) => {
      updateUrl({
        zoom,
        center: Array.isArray(center)
          ? { latitude: center[1], longitude: center[0] }
          : { latitude: center.lat, longitude: center.lng },
      });
    },
    500,
  );

  async function handlePickPoint(point: GeoPoint) {
    const fallback = `Punto ${point.latitude.toLocaleString("es-ES", { maximumFractionDigits: 4 })}, ${point.longitude.toLocaleString("es-ES", { maximumFractionDigits: 4 })}`;
    let label: string;
    try {
      label = (await reverseGeocode(point.latitude, point.longitude)) ?? fallback;
    } catch {
      label = fallback;
    }

    if (pickMode === "origin") {
      setOriginPoint(point);
      setOriginLabel(label);
      setAnnouncement(`Origen fijado en ${label}`);
      updateUrl({ origin: point, originLabel: label });
      setPickMode("destination");
    } else if (pickMode === "destination") {
      setDestinationPoint(point);
      setDestinationLabel(label);
      setAnnouncement(`Destino fijado en ${label}`);
      updateUrl({ destination: point, destinationLabel: label });
      setPickMode("none");
    }
    mapRef.current?.ensureVisible(point);
  }

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (url.origin) {
      setOriginPoint(url.origin);
      setOriginLabel(url.originLabel);
    }
    if (url.destination) {
      setDestinationPoint(url.destination);
      setDestinationLabel(url.destinationLabel);
    }
    if (url.origin && url.destination) {
      handleSearch({
        origin: url.originLabel,
        destination: url.destinationLabel,
        originPoint: url.origin,
        destinationPoint: url.destination,
        activity: url.activity,
        departureTime: url.departureTime || new Date().toISOString(),
        maxDurationMinutes: url.maxDurationMinutes,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || url.zoom === null || url.center === null) return;
    map.jumpTo([url.center.longitude, url.center.latitude], url.zoom);
  }, [url.zoom, url.center]);

  function handleRetry() {
    analysis.retry();
    setSelectedRouteId(null);
  }

  async function handleRunHistory(entry: HistoryEntry) {
    setHistoryOpen(false);
    const [originResult, destinationResult] = await Promise.allSettled([
      resolvePlace(entry.origin),
      resolvePlace(entry.destination),
    ]);
    const origin = originResult.status === "fulfilled" ? originResult.value : null;
    const destination = destinationResult.status === "fulfilled" ? destinationResult.value : null;
    if (origin === null || destination === null) {
      addToast("error", "No pudimos repetir esa búsqueda. Revisa las ubicaciones guardadas.");
      return;
    }
    handleSearch({
      origin: origin.label,
      destination: destination.label,
      originPoint: { latitude: origin.lat, longitude: origin.lon },
      destinationPoint: { latitude: destination.lat, longitude: destination.lon },
      activity: entry.activity,
      departureTime: entry.departureTimeUtc,
      maxDurationMinutes: entry.maxDurationMinutes,
    });
  }

  function handleNewSearch() {
    analysis.reset();
    setOriginLabel("");
    setDestinationLabel("");
    setOriginPoint(null);
    setDestinationPoint(null);
    setSelectedRouteId(null);
    updateUrl({
      origin: null,
      originLabel: "",
      destination: null,
      destinationLabel: "",
      selectedRouteIndex: null,
      zoom: null,
      center: null,
    });
  }

  function handleLocationError() {
    addToast("error", LOCATION_ERROR_MESSAGE);
  }

  function openAbout(section?: AboutSection) {
    setAboutSection(section ?? null);
    setAboutOpen(true);
  }

  return (
    <>
      <AppShell
        isCompact={isCompact}
        headerSlot={
          <Header onOpenAbout={() => openAbout()} onOpenHistory={() => setHistoryOpen(true)} />
        }
        sidebarSlot={
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
            <PlannerSheet
              busy={status === "loading"}
              onSearch={handleSearch}
              onLocationError={handleLocationError}
              pickMode={pickMode}
              externalOrigin={originPoint ? { label: originLabel, point: originPoint } : null}
              externalDestination={
                destinationPoint ? { label: destinationLabel, point: destinationPoint } : null
              }
              onClearExternalOrigin={() => {
                setOriginPoint(null);
                setOriginLabel("");
                updateUrl({ origin: null, originLabel: "" });
                setPickMode("origin");
              }}
              onClearExternalDestination={() => {
                setDestinationPoint(null);
                setDestinationLabel("");
                updateUrl({ destination: null, destinationLabel: "" });
                setPickMode("destination");
              }}
            />
            <RefreshingIndicator visible={refreshing} />
            <ResultsLayer
              viewState={status}
              routes={result?.routes ?? []}
              weatherAvailable={result?.weatherAvailable ?? true}
              routeAvailable={result?.routeAvailable ?? true}
              selectedRouteId={selectedRouteId}
              activityLabel={ACTIVITY_LABELS[activity]}
              onSelectRoute={handleSelectRoute}
              onRetry={handleRetry}
              onNewSearch={handleNewSearch}
              error={status === "error" ? ERROR_MESSAGE : null}
            />
          </div>
        }
        welcomeSlot={
          status === "idle" ? (
            <EmptyState
              title="Tu ruta, con el clima en cuenta"
              description="Introduce el origen y el destino, elige tu actividad y compara las rutas según la previsión meteorológica."
            />
          ) : undefined
        }
      >
        <MapCanvas
          ref={mapRef}
          routes={mapRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={handleSelectRoute}
          originPoint={originPoint ?? undefined}
          destinationPoint={destinationPoint ?? undefined}
          isCompact={isCompact}
          pickMode={pickMode}
          onPickPoint={handlePickPoint}
          hoveredRouteId={hoveredRouteId}
          onHoverRoute={setHoveredRouteId}
          probePoint={probePoint}
          onCameraChange={syncCamera}
        />
        <div className="absolute left-4 top-4 z-20">
          <PickModeBar
            pickMode={pickMode}
            onChange={setPickMode}
            onFitView={() => mapRef.current?.fitToRoutes()}
          />
        </div>
        <div className="absolute left-4 top-20 z-20">
          <RouteDetailCard
            route={selectedRoute}
            weatherAvailable={result?.weatherAvailable ?? true}
            onHoverSegment={setHoveredSegment}
            onClose={() => setSelectedRouteId(null)}
            onHowCalculated={() => openAbout("score")}
          />
        </div>
        <MapControlBar compact={isCompact} />
        <LiveRegion message={announcement} />
      </AppShell>
      <HistorySheet
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        entries={history.entries}
        onRun={handleRunHistory}
        onRemove={history.remove}
      />
      <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} focusSection={aboutSection} />
    </>
  );
}