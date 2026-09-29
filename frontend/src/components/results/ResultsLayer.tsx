import type { ReactNode } from "react";
import type { RouteCandidate } from "../../types";
import Button from "../ui/Button";
import ErrorState from "../ui/ErrorState";
import LoadingState from "../ui/LoadingState";
import RouteList from "./RouteList";

export type ResultsViewState = "idle" | "loading" | "error" | "full" | "partial";

export interface ResultsLayerProps {
  viewState: ResultsViewState;
  routes: RouteCandidate[];
  weatherAvailable: boolean;
  routeAvailable: boolean;
  selectedRouteId: number | null;
  activityLabel: string;
  onSelectRoute: (routeIndex: number) => void;
  onRetry: () => void;
  onNewSearch: () => void;
  error?: string | null;
}

const WEATHER_UNAVAILABLE_MESSAGE = "No hay previsión meteorológica para esa fecha — máximo 7 días.";
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
  activityLabel,
  onSelectRoute,
  onRetry,
  onNewSearch,
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
  const noRouteReason = !routeAvailable;

  return (
    <div className="space-y-4">
      {!weatherAvailable && hasRoutes && <PartialBanner>{WEATHER_UNAVAILABLE_MESSAGE}</PartialBanner>}
      {noRouteReason && (
        <ErrorState
          title="No hay ruta posible"
          message={`No encontramos ninguna ruta con perfil de ${activityLabel} entre esos dos puntos. Prueba a mover los extremos o a cambiar de actividad.`}
          onRetry={onRetry}
        />
      )}

      {hasRoutes ? (
        <RouteList
          routes={routes}
          weatherAvailable={weatherAvailable}
          selectedRouteId={selectedRouteId}
          onSelectRoute={onSelectRoute}
          onNewSearch={onNewSearch}
        />
      ) : (
        !noRouteReason && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onNewSearch}>
              Nueva búsqueda
            </Button>
          </div>
        )
      )}
    </div>
  );
}