export type Listener = (...args: unknown[]) => void;

export interface MapOptions {
  container: HTMLElement;
  style: string;
  center: [number, number];
  zoom: number;
  minZoom?: number;
  maxZoom?: number;
}

interface RegisteredListener {
  handler: Listener;
  layerId?: string;
  once: boolean;
}

export class MapStub {
  static instances: MapStub[] = [];
  static reset(): void {
    MapStub.instances = [];
  }

  options: MapOptions;
  removed = false;
  sources: Map<string, GeoJSONSource>;
  layers: Map<string, { id: string; filter?: unknown }>;
  controls: Array<{ control: unknown; position?: string }> = [];
  fitBoundsCalls: Array<{ bounds: LngLatBounds; options?: Record<string, unknown> }> = [];
  private listeners: Map<string, RegisteredListener[]> = new Map();

  constructor(options: MapOptions) {
    this.options = options;
    this.sources = new Map();
    this.layers = new Map();
    MapStub.instances.push(this);
  }

  on(type: string, handler: Listener): this;
  on(type: string, layerId: string, handler: Listener): this;
  on(type: string, layerOrHandler: string | Listener, maybeHandler?: Listener): this {
    if (typeof layerOrHandler === "string") {
      this.register(type, maybeHandler!, layerOrHandler);
    } else {
      this.register(type, layerOrHandler);
    }
    return this;
  }

  once(type: string, handler: Listener): this {
    this.register(type, handler, undefined, true);
    return this;
  }

  off(type: string, handler: Listener): this {
    const list = this.listeners.get(type);
    if (!list) return this;
    this.listeners.set(
      type,
      list.filter((entry) => entry.handler !== handler),
    );
    return this;
  }

  addSource(id: string, spec: { type: string; data?: unknown }): this {
    this.sources.set(id, new GeoJSONSource(spec.data));
    return this;
  }

  getSource(id: string): GeoJSONSource | undefined {
    return this.sources.get(id);
  }

  addLayer(spec: { id: string; type?: string; source?: string; filter?: unknown; paint?: unknown }): this {
    this.layers.set(spec.id, { id: spec.id, filter: spec.filter });
    return this;
  }

  getLayer(id: string): { id: string; filter?: unknown } | undefined {
    return this.layers.get(id);
  }

  setFilter(id: string, filter: unknown): this {
    const layer = this.layers.get(id);
    if (layer) layer.filter = filter;
    return this;
  }

  fitBounds(bounds: LngLatBounds, options?: Record<string, unknown>): this {
    this.fitBoundsCalls.push({ bounds, options });
    return this;
  }

  isStyleLoaded(): boolean {
    return false;
  }

  addControl(control: unknown, position?: string): this {
    this.controls.push({ control, position });
    return this;
  }

  remove(): void {
    this.removed = true;
    this.listeners.clear();
  }

  _emit(type: string, ...args: unknown[]): void {
    if (typeof args[0] === "string" && args.length > 1) args = args.slice(1);
    const list = this.listeners.get(type);
    if (!list) return;
    for (const entry of list.slice()) {
      entry.handler(...args);
    }
    this.listeners.set(
      type,
      list.filter((entry) => !entry.once),
    );
  }

  private register(type: string, handler: Listener, layerId?: string, once = false): void {
    const list = this.listeners.get(type) ?? [];
    list.push({ handler, layerId, once });
    this.listeners.set(type, list);
  }
}

export class GeoJSONSource {
  data: unknown;

  constructor(data?: unknown) {
    this.data = data;
  }

  setData(data: unknown): this {
    this.data = data;
    return this;
  }

  getData(): unknown {
    return this.data;
  }
}

export class LngLatBounds {
  private sw: [number, number];
  private ne: [number, number];

  constructor(southWest?: [number, number], northEast?: [number, number]) {
    this.sw = southWest ?? [Infinity, Infinity];
    this.ne = northEast ?? [-Infinity, -Infinity];
  }

  extend(lngLat: [number, number] | LngLatBounds): this {
    if (lngLat instanceof LngLatBounds) {
      this.extend([lngLat.getWest(), lngLat.getSouth()]);
      this.extend([lngLat.getEast(), lngLat.getNorth()]);
      return this;
    }
    this.sw = [Math.min(this.sw[0], lngLat[0]), Math.min(this.sw[1], lngLat[1])];
    this.ne = [Math.max(this.ne[0], lngLat[0]), Math.max(this.ne[1], lngLat[1])];
    return this;
  }

  getWest(): number {
    return this.sw[0];
  }

  getSouth(): number {
    return this.sw[1];
  }

  getEast(): number {
    return this.ne[0];
  }

  getNorth(): number {
    return this.ne[1];
  }
}

export interface MarkerOptions {
  element?: HTMLElement;
}

export class Marker {
  static instances: Marker[] = [];
  static reset(): void {
    Marker.instances = [];
  }

  element?: HTMLElement;
  lngLat: [number, number] | undefined;
  map: MapStub | undefined;
  removed = false;

  constructor(options: MarkerOptions = {}) {
    this.element = options.element;
    Marker.instances.push(this);
  }

  setLngLat(lngLat: [number, number]): this {
    this.lngLat = lngLat;
    return this;
  }

  addTo(map: MapStub): this {
    this.map = map;
    return this;
  }

  remove(): this {
    this.removed = true;
    this.map = undefined;
    return this;
  }
}

export class Popup {
  static instances: Popup[] = [];
  static reset(): void {
    Popup.instances = [];
  }

  options: Record<string, unknown>;
  html: string | undefined;
  lngLat: [number, number] | undefined;
  map: MapStub | undefined;
  removed = false;

  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
    Popup.instances.push(this);
  }

  setHTML(html: string): this {
    this.html = html;
    return this;
  }

  setLngLat(lngLat: [number, number]): this {
    this.lngLat = lngLat;
    return this;
  }

  addTo(map: MapStub): this {
    this.map = map;
    return this;
  }

  remove(): this {
    this.removed = true;
    this.map = undefined;
    return this;
  }
}

export class NavigationControl {}

export { MapStub as Map };

const maplibregl = {
  Map: MapStub,
  GeoJSONSource,
  LngLatBounds,
  Marker,
  Popup,
  NavigationControl,
};

export default maplibregl;