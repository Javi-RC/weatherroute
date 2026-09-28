import { useRef, type KeyboardEvent } from "react";
import type { RouteCandidate } from "../../types";
import BestRouteBanner from "./BestRouteBanner";
import RouteCard from "./RouteCard";

export interface RouteListProps {
  routes: RouteCandidate[];
  weatherAvailable: boolean;
  selectedRouteId: number | null;
  onSelectRoute: (index: number) => void;
  onNewSearch: () => void;
}

export default function RouteList({
  routes,
  weatherAvailable,
  selectedRouteId,
  onSelectRoute,
  onNewSearch,
}: RouteListProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndSelect(index: number) {
    if (routes.length === 0) return;
    const bounded = (index + routes.length) % routes.length;
    onSelectRoute(bounded);
    itemRefs.current[bounded]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusAndSelect(index + 1);
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      focusAndSelect(index - 1);
    }
  }

  return (
    <div className="space-y-4">
      <BestRouteBanner routes={routes} onNewSearch={onNewSearch} />
      <ul data-testid="route-list" className="space-y-3">
        {routes.map((route, index) => (
          <li key={`${index}-${route.providerId}`}>
            <RouteCard
              index={index}
              route={route}
              isSelected={selectedRouteId === index}
              hasSelection={selectedRouteId !== null}
              weatherAvailable={weatherAvailable}
              onSelect={onSelectRoute}
              onKeyDown={(event) => onKeyDown(event, index)}
              cardRef={(element) => {
                itemRefs.current[index] = element;
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
