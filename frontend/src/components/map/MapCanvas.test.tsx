import { act, render } from "@testing-library/react";
import { createRef } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatDistance, formatDuration, formatScore } from "../../lib/format";
import type { MapRouteInput } from "../../lib/map";
import {
  Map as StubMap,
  Marker as StubMarker,
  Popup as StubPopup,
  type GeoJSONSource as StubGeoJSONSource,
} from "../../../test/stubs/maplibre";
import MapCanvas, { type MapCanvasHandle } from "./MapCanvas";

vi.mock("maplibre-gl", () => import("../../../test/stubs/maplibre"));

const WORLD_STYLE = "https://tiles.openfreemap.org/styles/liberty";

const ORIGIN = { latitude: 42.5, longitude: 1.5 };
const DESTINATION = { latitude: 42.6, longitude: 1.7 };

function route(overrides: Partial<MapRouteInput> = {}): MapRouteInput {
  return {
    riskLevel: "Low",
    distanceKm: 12.4,
    durationMinutes: 75,
    score: 78,
    originLabel: "Andorra la Vella",
    destinationLabel: "Encamp",
    geometry: { type: "LineString", coordinates: [[1.5, 42.5], [1.7, 42.6]] },
    selected: false,
    ...overrides,
  };
}

function makeRoutes(count: number): MapRouteInput[] {
  return Array.from({ length: count }, () => route());
}

function emitLoad(map: StubMap): void {
  act(() => map._emit("load"));
}

describe("MapCanvas", () => {
  beforeEach(() => {
    StubMap.reset();
    StubMarker.reset();
    StubPopup.reset();
  });

  it("mounts with the world as the default view", () => {
    render(<MapCanvas routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} />);

    const map = StubMap.instances.at(-1)!;
    expect(map).toBeDefined();
    expect(map.options.style).toBe(WORLD_STYLE);
    expect(map.options.center).toEqual([0, 25]);
    expect(map.options.zoom).toBe(2);
    expect(map.options.minZoom).toBe(2);
  });

  it("declares no sources or layers until the style load fires", () => {
    render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;

    expect(map.getSource("routes")).toBeUndefined();
    expect(map.getLayer("route-casing")).toBeUndefined();
    expect(map.getLayer("route-hover")).toBeUndefined();
    expect(map.getLayer("route-lines")).toBeUndefined();
  });

  it("declares casing, hover and lines layers in that order", () => {
    render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;

    emitLoad(map);

    expect([...map.layers.keys()]).toEqual(["route-casing", "route-hover", "route-lines"]);
    expect(map.getLayer("route-casing")?.filter).toEqual(["==", ["get", "selected"], true]);
    expect(map.getLayer("route-hover")?.filter).toEqual(["==", "$id", -1]);
  });

  it("adds source and layers exactly once after load, then paints the routes", () => {
    render(<MapCanvas routes={makeRoutes(2)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;

    emitLoad(map);

    const source = map.getSource("routes") as StubGeoJSONSource;
    expect(source).toBeDefined();
    expect(map.getLayer("route-casing")).toBeDefined();
    expect(map.getLayer("route-hover")).toBeDefined();
    expect(map.getLayer("route-lines")).toBeDefined();
    expect(map.controls.length).toBe(2);

    const data = source.getData() as { type: string; features: unknown[] };
    expect(data.type).toBe("FeatureCollection");
    expect(data.features).toHaveLength(2);
  });

  it("paints the selected route at full opacity and the rest dimmed", () => {
    render(
      <MapCanvas
        routes={[route({ selected: true }), route({ selected: false })]}
        selectedRouteId={0}
        onSelectRoute={vi.fn()}
      />,
    );
    const map = StubMap.instances.at(-1)!;

    emitLoad(map);

    const source = map.getSource("routes") as StubGeoJSONSource;
    const features = (source.getData() as { features: Array<{ properties: { selected: boolean } }> }).features;
    expect(features[0].properties.selected).toBe(true);
    expect(features[1].properties.selected).toBe(false);
  });

  it("repaints via setData on route changes without re-declaring layers", () => {
    const { rerender } = render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    rerender(<MapCanvas routes={makeRoutes(3)} selectedRouteId={null} onSelectRoute={vi.fn()} />);

    expect(map.sources.size).toBe(1);
    const data = (map.getSource("routes") as StubGeoJSONSource).getData() as { features: unknown[] };
    expect(data.features).toHaveLength(3);
  });

  it("applies routes received before the load event (no paint race)", () => {
    const { rerender } = render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;

    rerender(<MapCanvas routes={makeRoutes(4)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    emitLoad(map);

    const data = (map.getSource("routes") as StubGeoJSONSource).getData() as { features: unknown[] };
    expect(data.features).toHaveLength(4);
  });

  it("never reframes the map on its own", () => {
    const { rerender } = render(
      <MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />,
    );
    const map = StubMap.instances.at(-1)!;

    emitLoad(map);
    expect(map.fitBoundsCalls).toHaveLength(0);

    rerender(<MapCanvas routes={makeRoutes(3)} selectedRouteId={2} onSelectRoute={vi.fn()} />);

    expect(map.fitBoundsCalls).toHaveLength(0);
  });

  it("skips fitBounds when there are no routes", () => {
    render(<MapCanvas routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    expect(map.fitBoundsCalls).toHaveLength(0);
  });

  it("keeps the casing filter on the selected property when the selection changes", () => {
    const { rerender } = render(<MapCanvas routes={makeRoutes(3)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    expect(map.getLayer("route-casing")?.filter).toEqual(["==", ["get", "selected"], true]);

    rerender(<MapCanvas routes={makeRoutes(3)} selectedRouteId={1} onSelectRoute={vi.fn()} />);

    expect(map.getLayer("route-casing")?.filter).toEqual(["==", ["get", "selected"], true]);
  });

  it("places A/B marker chips for origin and destination", () => {
    render(
      <MapCanvas
        routes={makeRoutes(1)}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
        originPoint={ORIGIN}
        destinationPoint={DESTINATION}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    expect(StubMarker.instances).toHaveLength(2);
    const [origin, destination] = StubMarker.instances;
    expect(origin.element?.textContent).toBe("A");
    expect(origin.element?.getAttribute("aria-hidden")).toBe("true");
    expect(origin.element?.className).toContain("rounded-full");
    expect(origin.lngLat).toEqual([1.5, 42.5]);
    expect(destination.element?.textContent).toBe("B");
    expect(destination.lngLat).toEqual([1.7, 42.6]);
  });

  it("removes markers when origin/destination are cleared", () => {
    const { rerender } = render(
      <MapCanvas
        routes={makeRoutes(1)}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
        originPoint={ORIGIN}
        destinationPoint={DESTINATION}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    rerender(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);

    expect(StubMarker.instances[0].removed).toBe(true);
    expect(StubMarker.instances[1].removed).toBe(true);
  });

  it("selects a route and opens a summary popup when a line is clicked", () => {
    const onSelectRoute = vi.fn();
    const clicked = route({ distanceKm: 12.4, durationMinutes: 75, score: 78 });
    render(<MapCanvas routes={[clicked]} selectedRouteId={null} onSelectRoute={onSelectRoute} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() =>
      map._emit("click", "route-lines", {
        features: [{ properties: { routeIndex: 0 } }],
        lngLat: [1.6, 42.55],
      }),
    );

    expect(onSelectRoute).toHaveBeenCalledWith(0);
    const popup = StubPopup.instances.at(-1)!;
    expect(popup.html).toContain(formatDistance(12.4));
    expect(popup.html).toContain(formatDuration(75));
    expect(popup.html).toContain(formatScore(78));
    expect(popup.html).toContain("Andorra la Vella");
  });

  it("escapes route labels inside the popup HTML", () => {
    const onSelectRoute = vi.fn();
    render(
      <MapCanvas
        routes={[route({ originLabel: "A <script>", destinationLabel: "B \"quote\"" })]}
        selectedRouteId={null}
        onSelectRoute={onSelectRoute}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() =>
      map._emit("click", "route-lines", {
        features: [{ properties: { routeIndex: 0 } }],
        lngLat: [1.6, 42.55],
      }),
    );

    const popup = StubPopup.instances.at(-1)!;
    expect(popup.html).toContain("A &lt;script&gt;");
    expect(popup.html).not.toContain("<script>");
    expect(popup.html).toContain("B &quot;quote&quot;");
  });

  it("keeps a single map instance when isCompact flips", () => {
    const { rerender } = render(
      <MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} isCompact={false} />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    expect(StubMap.instances).toHaveLength(1);

    rerender(
      <MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} isCompact />,
    );

    expect(StubMap.instances).toHaveLength(1);
    expect(StubMap.instances[0].removed).toBe(false);
    expect(map.fitBoundsCalls).toHaveLength(0);
  });

  it("does not render a bare arrow in the popup when one label is empty", () => {
    render(
      <MapCanvas
        routes={[route({ originLabel: "Solo origen", destinationLabel: "" })]}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() =>
      map._emit("click", "route-lines", {
        features: [{ properties: { routeIndex: 0 } }],
        lngLat: [1.6, 42.55],
      }),
    );

    const popup = StubPopup.instances.at(-1)!;
    expect(popup.html).toContain("Solo origen");
    expect(popup.html).not.toContain("→");
  });

  it("picks a point when the map is clicked while picking", () => {
    const onPickPoint = vi.fn();
    render(<MapCanvas routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} pickMode="origin" onPickPoint={onPickPoint} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    map.renderedFeatures = [];

    act(() => map._emit("click", { lngLat: { lng: -3.7038, lat: 40.4168 }, point: { x: 0, y: 0 } }));

    expect(onPickPoint).toHaveBeenCalledWith({ latitude: 40.4168, longitude: -3.7038 });
  });

  it("selects the route instead of picking when the click lands on one", () => {
    const onPickPoint = vi.fn();
    const onSelectRoute = vi.fn();
    render(
      <MapCanvas
        routes={makeRoutes(1)}
        selectedRouteId={null}
        onSelectRoute={onSelectRoute}
        pickMode="origin"
        onPickPoint={onPickPoint}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    map.renderedFeatures = [{ properties: { routeIndex: 0 } }];

    act(() => map._emit("click", "route-lines", { lngLat: [0, 0], point: { x: 0, y: 0 }, features: [{ properties: { routeIndex: 0 } }] }));

    expect(onSelectRoute).toHaveBeenCalledWith(0);
    expect(onPickPoint).not.toHaveBeenCalled();
  });

  it("ignores clicks on the map when no mode is active", () => {
    const onPickPoint = vi.fn();
    render(<MapCanvas routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} pickMode="none" onPickPoint={onPickPoint} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    map.renderedFeatures = [];

    act(() => map._emit("click", { lngLat: { lng: 0, lat: 0 }, point: { x: 0, y: 0 } }));

    expect(onPickPoint).not.toHaveBeenCalled();
  });

  it("shows a crosshair cursor while picking and clears it afterwards", () => {
    const { rerender } = render(
      <MapCanvas routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} pickMode="destination" />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    expect(map.getCanvas().style.cursor).toBe("crosshair");

    rerender(<MapCanvas routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} pickMode="none" />);

    expect(map.getCanvas().style.cursor).toBe("");
  });

  it("shows a pointer cursor over a route", () => {
    render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() => map._emit("mousemove", "route-lines", { point: { x: 0, y: 0 }, features: [{ properties: { routeIndex: 0 } }] }));
    expect(map.getCanvas().style.cursor).toBe("pointer");

    act(() => map._emit("mouseleave", "route-lines", { point: { x: 0, y: 0 } }));
    expect(map.getCanvas().style.cursor).toBe("");
  });

  it("frames the routes on demand", () => {
    const ref = createRef<MapCanvasHandle>();
    render(
      <MapCanvas
        ref={ref}
        routes={makeRoutes(2)}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    map.fitBoundsCalls.length = 0;

    act(() => ref.current?.fitToRoutes());

    expect(map.fitBoundsCalls).toHaveLength(1);
    expect(map.fitBoundsCalls[0].options).toMatchObject({ maxZoom: 14 });
    expect(map.fitBoundsCalls[0].bounds.getWest()).toBeCloseTo(1.5);
    expect(map.fitBoundsCalls[0].bounds.getNorth()).toBeCloseTo(42.6);
  });

  it("does nothing when fitting with no routes", () => {
    const ref = createRef<MapCanvasHandle>();
    render(<MapCanvas ref={ref} routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);
    map.fitBoundsCalls.length = 0;

    act(() => ref.current?.fitToRoutes());

    expect(map.fitBoundsCalls).toHaveLength(0);
  });

  it("eases to a point only when it sits outside the viewport", () => {
    const ref = createRef<MapCanvasHandle>();
    render(<MapCanvas ref={ref} routes={[]} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() => ref.current?.ensureVisible({ latitude: 25, longitude: 0 }));
    expect(map.easeToCalls).toHaveLength(0);

    act(() => ref.current?.ensureVisible({ latitude: 40.4168, longitude: -3.7038 }));
    expect(map.easeToCalls).toHaveLength(1);
    expect(map.easeToCalls[0]).toMatchObject({ center: [-3.7038, 40.4168] });
  });

  it("does not echo its own programmatic jumpTo back to onCameraChange", () => {
    const onCameraChange = vi.fn();
    const ref = createRef<MapCanvasHandle>();
    render(
      <MapCanvas
        ref={ref}
        routes={[]}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
        onCameraChange={onCameraChange}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() => ref.current?.jumpTo([2.5, 40.0], 5));
    expect(map.jumpToCalls).toHaveLength(1);
    expect(onCameraChange).not.toHaveBeenCalled();
  });

  it("reports user-driven camera changes to onCameraChange", () => {
    const onCameraChange = vi.fn();
    render(
      <MapCanvas
        routes={[]}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
        onCameraChange={onCameraChange}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() => map._emit("moveend"));
    expect(onCameraChange).toHaveBeenCalled();
  });

  it("highlights the hovered route and reports it", () => {
    const onHoverRoute = vi.fn();
    render(
      <MapCanvas
        routes={makeRoutes(2)}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
        onHoverRoute={onHoverRoute}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() => map._emit("mousemove", "route-lines", { point: { x: 0, y: 0 }, features: [{ properties: { routeIndex: 1 } }] }));

    expect(onHoverRoute).toHaveBeenCalledWith(1);
    expect(map.getLayer("route-hover")?.filter).toEqual(["==", "$id", -1]);
  });

  it("clears the hover when the pointer leaves a route", () => {
    const onHoverRoute = vi.fn();
    render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} onHoverRoute={onHoverRoute} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    act(() => map._emit("mouseleave", "route-lines", {}));

    expect(onHoverRoute).toHaveBeenCalledWith(null);
  });

  it("moves the hover filter to the hovered index", () => {
    const { rerender } = render(
      <MapCanvas routes={makeRoutes(2)} selectedRouteId={null} onSelectRoute={vi.fn()} hoveredRouteId={1} />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    expect(map.getLayer("route-hover")?.filter).toEqual(["==", "$id", 1]);

    rerender(<MapCanvas routes={makeRoutes(2)} selectedRouteId={null} onSelectRoute={vi.fn()} hoveredRouteId={null} />);

    expect(map.getLayer("route-hover")?.filter).toEqual(["==", "$id", -1]);
  });

  it("renders a probe marker at the hovered profile point", () => {
    render(
      <MapCanvas
        routes={makeRoutes(1)}
        selectedRouteId={null}
        onSelectRoute={vi.fn()}
        probePoint={{ latitude: 40.5, longitude: -3.9 }}
      />,
    );
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    const probe = StubMarker.instances.at(-1)!;
    expect(probe.element?.textContent).toBe("•");
    expect(probe.lngLat).toEqual([-3.9, 40.5]);
  });

  it("cleans up the map on unmount", () => {
    const { unmount } = render(<MapCanvas routes={makeRoutes(1)} selectedRouteId={null} onSelectRoute={vi.fn()} />);
    const map = StubMap.instances.at(-1)!;
    emitLoad(map);

    unmount();

    expect(map.removed).toBe(true);
  });
});