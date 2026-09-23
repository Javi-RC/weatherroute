import type { ReactNode } from "react";
import type { RouteCandidate } from "../../types";
import Button from "../ui/Button";
import ErrorState from "../ui/ErrorState";
import LoadingState from "../ui/LoadingState";
import BestRouteBanner from "./BestRouteBanner";
import RouteCard from "./RouteCard";
import RouteDetail from "./RouteDetail";

export type ResultsViewState = "idle" | "loading" | "error" | "full" | "partial";

export interface ResultsLayerProps {
  viewState: ResultsViewState;
  routes: RouteCandidate[];
  weatherAvailable: boolean;
  routeAvailable: boolean;
  selectedRouteId: number | null;
  expandedRouteId: number | null;
  onSelectRoute: (routeIndex: number) => void;
  onToggleExpand: (routeIndex: number) => void;
  onCloseDetail: () => void;
  onRetry: () => void;
  onNewSearch: () => void;
  onHowCalculated?: () => void;
  error?: string | null;
}

const WEATHER_UNAVAILABLE_MESSAGE = "No hay previsión meteorológica para esa fecha — máximo 7 días.";
const ROUTE_UNAVAILABLE_MESSAGE = "El servicio de rutas no está disponible temporalmente.";
const DEFAULT_ERROR_MESSAGE = "No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.";

function PartialBanner({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="rounded-lg bg-amber-50 px-3 py-2.5 text-sm font-medium text-amber-800">
      {children}
    </p>
  );
}

export default function ResultsLayer({
  viewState,
  routes,
  weatherAvailable,
  routeAvailable,
  selectedRouteId,
  expandedRouteId,
  onSelectRoute,
  onToggleExpand,
  onCloseDetail,
  onRetry,
  onNewSearch,
  onHowCalculated,
  error,
}: ResultsLayerProps) {
  if (viewState === "idle") return null;

  if (viewState === "loading") return <LoadingState />;

  if (viewState === "error") {
    return (
      <ErrorState
        message={error?.trim() || DEFAULT_ERROR_MESSAGE}
        onRetry={onRetry}
      />
    );
  }

  const hasRoutes = routes.length > 0;

  return (
    <div className="space-y-4">
      {!weatherAvailable && <PartialBanner>{WEATHER_UNAVAILABLE_MESSAGE}</PartialBanner>}
      {!routeAvailable && <PartialBanner>{ROUTE_UNAVAILABLE_MESSAGE}</PartialBanner>}

      {hasRoutes ? (
        <>
          <BestRouteBanner routes={routes} onNewSearch={onNewSearch} />
          <ul data-testid="route-list" className="space-y-3">
            {routes.map((route, index) => (
              <li key={`${index}-${route.providerId}`}>
                <RouteCard
                  index={index}
                  route={route}
                  isSelected={selectedRouteId === index}
                  isExpanded={expandedRouteId === index}
                  weatherAvailable={weatherAvailable}
                  onSelect={onSelectRoute}
                  onToggleExpand={onToggleExpand}
                >
                  <RouteDetail
                    route={route}
                    index={index}
                    weatherAvailable={weatherAvailable}
                    onClose={onCloseDetail}
                    onHowCalculated={onHowCalculated}
                  />
                </RouteCard>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onNewSearch}>
            Nueva búsqueda
          </Button>
        </div>
      )}
    </div>
  );
}