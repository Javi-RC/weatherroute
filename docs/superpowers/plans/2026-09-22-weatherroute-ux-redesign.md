# WeatherRoute UX/UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn WeatherRoute from a form-centric single-screen MVP into a
mobile-first, map-centric, fully Spanish product with a real design system,
corrected risk mental-model, progressive-disclosure results, history,
geolocation, autocomplete, and accessibility — implementing
`docs/superpowers/specs/2026-09-21-weatherroute-ux-redesign.md`.

**Architecture:** React rebuild with a permanent full-viewport MapLibre canvas
(Google-Maps style), floating planner panel/sheet, results as a layered list
that cross-highlights with the map, and a single source of truth
`frontend/src/i18n/*` for the risk palette, Spanish labels and icons. One
minimal backend addition: geocode *search* (list) + *reverse* geocoding ports
and endpoints to power autocomplete and "usar mi ubicación".

**Tech stack:** React 19, TypeScript, Vite 6, Tailwind 4 (CSS-first `@theme`),
MapLibre GL JS, React Query, react-hook-form + zod (in the planner),
react-icons (already installed). Backend: .NET 10 hexagonal (C# 13), xUnit.
Tests: Vitest (jsdom) + Testing Library; xUnit on backend.

**Spec:** `docs/superpowers/specs/2026-09-21-weatherroute-ux-redesign.md`

**Phasing note:** the spec's 7 phases are regrouped here into 6 for dependency
coherence — map, results and planner components are built and tested standalone
*before* the App flip (Task 15); autocomplete/geolocation wait for the backend
extension (Task 20). All spec §10 requirements remain covered — see Task 23's
coverage map.

## Global constraints

- All UI copy in **Spanish**. Risk levels, factors, conditions and the
  recommendation must come from `i18n/*` modules — never hardcoded in JSX.
- Risk color is a **single source of truth**: `frontend/src/i18n/risk.ts`
  (`RISK_COLORS`); `index.css` mirrors it in `@theme` tokens with a
  "MANTENER SINCRONIZADO" comment. This kills the T1 triple-duplication
  (`riskColor` in RouteResults, `riskBadge` in ComparisonTable, `toColor` in
  RouteMap — all deleted by Task 15).
- The score is the **Índice de condiciones** (higher = better). Never render
  "riesgo 68/100". Risk level is a separate badge (icon + text, never color
  only).
- Layout always has the map visible; no side-scrolling tables.
- Backend risk engine stays untouched (presentation only).
- Never commit secrets or real API keys.

## Gates (CI parity — AGENTS.md)

```bash
# Frontend (after each task):
cd frontend && npm run typecheck && npm test && npm run build

# Backend (only when backend files change, e.g. Task 20):
dotnet build backend/WeatherRoute.slnx --no-restore -warnaserror
dotnet test backend/WeatherRoute.slnx --filter "Category!=Integration"
```

Commit after each green step, one focused change per commit
(`feat:|fix:|test:|docs:|chore:`).

---

# Fase 1 — UX Foundations

Acceptance: one file (`i18n/risk.ts`) defines the risk palette and all domain
translations; gates green.

## Task 1 — Design tokens (@theme)

**Files:** `frontend/src/index.css`

- Replace the single `@import "tailwindcss";` line with Tailwind 4 `@theme`
  block. Inline the stock Tailwind palette values (do not depend on network):
  - `ocean` (primary, azulado): cyan scale `#ecfeff … #164e63`, base ≈
    `#0e7490`.
  - `sand` (neutral arena): stone scale `#fafaf9 … #1c1917`.
  - `sun` (accent/emphasis): amber scale `#fffbeb … #78350f`.
  - Risk semantic tokens (mirror of `i18n/risk.ts`), with `-bg`/`-text` pairs
    that pass 4.5:1 contrast:
    `--color-risk-low(-bg|-text)`, `--color-risk-moderate(-bg|-text)`,
    `--color-risk-high(-bg|-text)`, `--color-risk-severe(-bg|-text)`.
  - UI semantic: `--color-success/*-warning/*-danger/*-info`.
- Typography: `--font-sans`: `ui-sans-serif, system-ui, "Segoe UI", Roboto,
  "Helvetica Neue", Arial, sans-serif;`.
- Radii: `--radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;
  --radius-full: 9999px;`.
- Shadows: `--shadow-card`, `--shadow-raise` (two elevations).
- Motion: `--ease-out` etc. and a `@media (prefers-reduced-motion:
  no-preference)` wrapper plan for later animations (Task 22).
- Add comment `/* MANTENER SINCRONIZADO con frontend/src/i18n/risk.ts (RISK_COLORS) */`.

**Tests:** none required here (pure tokens); verify utilities like
`bg-ocean-600`, `bg-risk-low-bg` compile.

**Gate:** frontend gate above.

## Task 2 — i18n source of truth + translation tests

**Files (new):** `frontend/src/i18n/risk.ts`, `frontend/src/i18n/factors.ts`,
`frontend/src/i18n/conditions.ts`, `frontend/src/i18n/recommendation.ts`,
plus `frontend/src/i18n/*.test.ts`.

- `risk.ts`:
  - `RISK_COLORS` (`as const`): keyed by `RiskLevel`
    (`Low|Moderate|High|Severe`) → `{ base, bg, text }` hexes (base = icon/fill
    color, `bg` = badge background, `text` = badge text, ≥4.5:1 contrast).
  - `riskLevelLabel(level): string` → "Riesgo bajo | Riesgo moderado |
    Riesgo alto | Riesgo extremo" (fallback for unknown → "Riesgo").
  - `conditionsLabel(score): string`: `≥80` "Muy buenas", `≥60` "Buenas",
    `≥40` "Aceptables", else "Malas".
  - `CONDITIONS_NOTE = "Más alto = mejores condiciones"`.
- `factors.ts`: `FACTOR_META` keyed by `factor.type`
  (`WIND|TEMPERATURE|HEAT|RAIN|STORM|SNOW|VISIBILITY|UV`):
  Viento→`FaWind`, Temperatura→`FaThermometerHalf`, Calor→`FaThermometerFull`,
  Lluvia→`FaCloudRain`, Tormenta→`FaBolt`, Nieve→`FaSnowflake`,
  Visibilidad→`FaEye`, Radiación UV→`FaSun`; plus `weightLabel(contribution)`
  → `|c|≥40` "Gran impacto", `≥15` "Moderado", else "Leve"; and a
  `formatFactorValue(type, rawNumber)` for the Spanish value string when the
  raw metric is available (e.g. wind "32 km/h"); fallback entry for unknown
  types (icon `FaQuestion`, label "Factor desconocido").
- `conditions.ts`: `CONDITION_META` for `Clear|Clouds|Fog|Rain|Snow|Storm|
  Unknown` → { label, icon, color }:
  Despejado/`FaSun`, Nublado/`FaCloud`, Niebla/`FaSmog`, Lluvia/`FaCloudRain`,
  Nieve/`FaSnowflake`, Tormenta/`FaBolt`, Sin datos/`FaQuestion`.
- `recommendation.ts`:
  `buildRecommendation(routes)` → Spanish string composed *from data* (never
  the backend `recommendation` string): pick best route by risk severity then
  shortest distance; format
  `"Ruta {n} recomendada: {distance}, {duration}, condiciones {label}"`; return
  `null` when no routes.
- Tests (`i18n/*.test.ts`): all known `RiskLevel`, `factor.type` and condition
  values have an entry (no `undefined` fallback hit for real values);
  `conditionsLabel` is monotonic at thresholds; `RISK_COLORS` text/bg pairs
  pass a 4.5:1 contrast computation (helper in the test, WCAG formula);
  `buildRecommendation` picks the expected route and formats Spanish.

**Gate:** frontend gate (this is where the risk palette lives).

## Task 3 — Formatting helpers

**Files (new):** `frontend/src/lib/format.ts` + `format.test.ts`.

- `formatDistance(km)`, `formatDuration(min)` ("2 h 48 m", "45 m"),
  `formatPercent(n)`, `formatTemperature(c)` ("22 °C"),
  `formatWind(kmh)` ("32 km/h"), `formatVisibility(km)` ("9 km"),
  `formatScore(score)` ("88/100"), `formatClockTime(date)` →
  `toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })`
  ("18:00"), `formatSavedAt(date)`.
- Spanish number formatting via `Intl.NumberFormat("es-ES")` (comma decimal).
- Tests for each; `formatClockTime` uses the browser local zone (document the
  UTC→local contract here: given a UTC instant, returns the local clock hour —
  cross-referenced by Task 20's contract test).

**Gate:** frontend gate.

## Task 4 — UI primitives

**Files (new):** `frontend/src/components/ui/Button.tsx`, `IconButton.tsx`,
`Badge.tsx`, `RiskBadge.tsx`, `Field.tsx`, `TextInput.tsx`, `Card.tsx`,
`SegmentedControl.tsx`, `Tooltip.tsx` (+ `.test.tsx` colocated).

- `Button`: variants primary/secondary/ghost/danger; sizes sm/md/lg; states
  rest/hover/focus-visible/pressed/disabled/loading (spinner + `aria-busy`);
  `:focus-visible` ring 2px (`focus-visible:ring-2 ring-offset-2`).
- `IconButton`: wrapper with required `aria-label`; ≥44px hit area on mobile.
- `Badge` (generic) + `RiskBadge`: `RiskBadge` renders
  `riskLevelLabel(level)` + level icon + color from `RISK_COLORS`, never color
  alone.
- `Field`: label + help text + inline error, wires `aria-describedby` and
  `aria-invalid` to a child input `id` (id from `useId`).
- `TextInput`: forwards `ref` + `aria-invalid`/`aria-describedby`; error border
  state.
- `Card`: consistent radius/`shadow-card`/padding.
- `SegmentedControl`: chips with `aria-pressed`, ≥40px targets, used later by
  time presets and activity (activity is its own component, Task 13).
- `Tooltip`: lightweight, `role="tooltip"`, keyboard accessible (focus/hover),
  used by SegmentStrip (Task 11) and ScoreGauge help.
- Render/state tests per primitive (focus-visible class present, disabled
  attr, aria wiring).

**Gate:** frontend gate.

## Task 5 — State primitives + Sheet

**Files (new):** `frontend/src/components/ui/EmptyState.tsx`,
`LoadingState.tsx`, `ErrorState.tsx`, `Sheet.tsx` (+ tests).

- `EmptyState`: icon + title + description + optional CTA (used as the
  welcome/idle overlay on the map).
- `LoadingState`: skeleton shaped like a real route card (bar for distance/
  duration/conditions) + `role="status"`; used by the route loading stage.
- `ErrorState`: message + "Reintentar" button + optional "keep data" hint
  ("conservamos tu búsqueda"); used both full-screen and inline.
- `Sheet` (reusable base for mobile planner, detail expansion, history, about):
  desktop panel or bottom sheet; `role="dialog" aria-modal="true"`; focus
  moves in on open; Esc closes; backdrop click closes; `prefers-reduced-motion`
  respected; usable as full-height with internal scroll.
- Tests: render + Esc/backdrop close + focus + eslint a11y attributes present.

**Gate:** frontend gate.

## Task 6 — Header + shell sketch

**Files (new):** `frontend/src/components/Header.tsx` (+ test).

- `Header`: sticky/fixed, `header` landmark; brand "WeatherRoute" (marca + ícono
  `FaRoute` or globe) with claim "Meteo en tu ruta, gratis, en cualquier lugar
  del mundo"; badge "Gratis · Sin registro"; actions "Cómo funciona"
  (`FaInfoCircle`, opens AboutModal — Task 19) and "Historial" (`FaHistory`,
  opens HistorySheet — Task 18). Buttons built with `IconButton`/`Button`
  primitives; hole components (AboutModal/HistorySheet) are no-ops this task.
- Tests: renders claim + actions; buttons have accessible names.
- Note: App is NOT rewired here (old UX keeps working until Task 15). Header
  is built standalone.
- Sketch (no commit of App change): create `frontend/src/layouts/AppShell.tsx`
  composing header + map slot + floating layers to be wired in Task 15 — build
  it but leave App untouched; its test asserts children slots render.

**Gate:** frontend gate.

# Fase 2 — Map canvas + Results components

## Task 7 — Map helpers

**Files (new):** `frontend/src/lib/map.ts` (+ `map.test.ts`).

- `buildRouteFeatures(routes)`: GeoJSON `FeatureCollection` where each feature
  carries properties `{ riskLevel, color (from RISK_COLORS), routeIndex,
  distanceKm, durationMinutes, score, originLabel, destinationLabel }` so the
  map stays palette-agnostic (imports `RISK_COLORS` — first consumer of the
  single source).
- `computeBounds(points)`: `{ east, west, north, south }` from a list of
  `{latitude, longitude}` (guard empty arrays → `null`).
- `fitBoundsOptions(view)}`: padding per breakpoint/layout — on mobile more
  bottom padding (sheets), on desktop symmetric; exported for MapCanvas.
- Tests: feature properties correct; bounds math; empty input → null.

**Gate:** frontend gate.

## Task 8 — MapCanvas + MapLegend (+ maplibre test stub)

**Files (new):** `frontend/src/components/map/MapCanvas.tsx`,
`frontend/src/components/map/MapLegend.tsx` (+ tests),
`frontend/test/stubs/maplibre.ts`.

- `MapCanvas` replaces `RouteMap` semantics (task 15 deletes the old file):
  - Full-viewport permanent canvas (`absolute inset-0`, base layer behind all
    UI). **Default view is the world** — low zoom, do NOT center on Andorra
    (e.g. `center: [0, 25]`, `zoom: 2`). Style: `https://tiles.openfreemap.org/styles/liberty`
    (free OSM tiles).
  - Init once on mount; cleanup `map.remove()`.
  - **No paint race:** on `map.once("load", paint)` do the first
    source/layer/paint pass (existing code paints only if routes exist and has
    a race). Use a guard flag.
  - Sources/layers: `routes` GeoJSON source (from `buildRouteFeatures`),
    `route-lines` line layer colored per feature; a `route-selected` layer
    (thicker, filter `["==", "$id", selectedIndex]`) for cross-highlight;
    markers A/B (`divIcon`-style markers, `aria-hidden`): origin "A"/"B" chips.
  - `fitBounds` when routes change using `computeBounds` + `fitBoundsOptions`.
  - Popup (on line click) with summary: distance, duration, índice; clicking a
    line also calls `onSelectRoute(routeIndex)`.
  - Props: `{ routes, selectedRouteId, onSelectRoute, originPoint?,
    destinationPoint? }`.
- `MapLegend`: fixed/overlaid legend of the 4 risk levels (color swatch + icon
  + Spanish label from `riskLevelLabel`/`RISK_COLORS`); collapsed on small
  screens (`aria-hidden` decorative swatches, text labels screen-reader only).
- `test/stubs/maplibre.ts`: manual stub exporting `Map`, `LngLatBounds`,
  `Marker`, `Popup`, `NavigationControl`, `GeoJSONSource` with the methods the
  component calls (`on/once/off/remove/addSource/setData/addLayer/getLayer/
  setFilter/fitBounds/isStyleLoaded/getSource`). Tests `vi.mock("maplibre-gl",
  () => stub)` and assert: world default center/zoom on mount; layers/source
  added after `load`; fitBounds called with routes bbox; selecting updates
  layer filter; cleanup `remove()` on unmount.

**Gate:** frontend gate.

## Task 9 — API + geocode validation

**Files:** `frontend/src/services/api.ts` (edit), `frontend/src/types.ts`
(edit), new `frontend/src/lib/places.ts` (+ tests).

- `types.ts`: add `interface GeocodeResult { lat: number; lon: number }`.
- `api.ts`: add `geocodePlace(q): Promise<GeocodeResult | null>` calling
  `GET /api/geocode?q=`; on non-OK/malformed → throw
  `new ApiError("geocode_failed", message)`. (Backend `no_results` → 404
  contract added in Task 20; this client must not crash on any status — it
  surfaces an error the planner renders as "No encontramos ese lugar".)
- `lib/places.ts`: `resolvePlace(input: string)` → trims, geocodes via
  `geocodePlace`, returns `{ label: input, lat, lon }` or `null` when the call
  fails; used by the planner's submit-time validation (Task 14) until
  autocomplete lands (Task 21).
- Tests: api layer mocked `fetch` (ok, 404, 500); `resolvePlace` trims and
  nulls on failure.

**Gate:** frontend gate.

## Task 10 — Time presets

**Files (new):** `frontend/src/lib/time.ts` (+ tests).

- `TIME_PRESETS`: `"now"` → "Ahora"; `"today-18"` → "Hoy 18:00";
  `"tomorrow-08"` → "Mañana 08:00" (dynamic labels via Spanish weekday when far;
  keep the exact chip strings from the spec).
- `presetDeparture(preset, now = new Date())`: UTC ISO string for each preset;
  if "Hoy 18:00" is already past, shift to tomorrow 18:00.
- Constraints: `minDate()` = today, `maxDate()` = today + 7 days;
  `clampDeparture(date)` caps at max date.
- `defaultDeparture()`: dynamic fallback for advanced inputs (today 08:00 if
  still future, else now) — fixes P10 (hardcoded `2026-09-27`).
- Tests: preset values shift correctly across "evening passed" cases; clamping;
  end of month rollover.

**Gate:** frontend gate. Deletes the hardcoded default date usage later in App.

## Task 11 — ScoreGauge, FactorList, SegmentStrip

**Files (new):**
`frontend/src/components/results/ScoreGauge.tsx`,
`frontend/src/components/results/FactorList.tsx`,
`frontend/src/components/results/SegmentStrip.tsx` (+ tests, some reusing data
from deleted `RiskBreakdown.test.tsx` fixture ideas).

- `ScoreGauge`: props `{ score }`. Renders Índice de condiciones: number
  `formatScore(score)`, `conditionsLabel(score)`, a horizontal bar/fill (width
  `score%`), `CONDITIONS_NOTE`. Fill color by conditions band (Muy buenas→emerald,
  Buenas→amber, Aceptables→orange, Malas→red) — separate from the risk badge
  palette. Accessibility: `role="meter"`, `aria-valuemin/max/now=0/100/score`,
  label "Índice de condiciones". Optional "¿Cómo se calcula?" `Tooltip` opening
  AboutModal (Task 19).
- `FactorList`: props `{ factors, onHowCalculated? }`. List each factor: icon +
  Spanish label (`FACTOR_META`), weight pill `weightLabel(contribution)` + n
  (±N), value text in Spanish where raw data available. Decorative icon
  `aria-hidden`; warning grouping not color-only.
- `SegmentStrip`: props `{ segments }` (+ `format…` helpers). Horizontal tiles
  (vertical stack on mobile) per segment: arrival `formatClockTime`, condition
  icon + short label, `formatTemperature`, mini rain/wind indicators with
  `Tooltip` showing full detail (Viento, UV, Visibilidad, condición completa).
  No chart axes, no scatter, no mixed units. `aria` list semantics.
- Tests: gauge meter attributes + thresholds; factor list maps every known
  type & unknown fallback; segment strip renders an icon per distinct condition
  and stacks on mobile class assertions (`flex-col`/`md:flex-row`).

**Gate:** frontend gate.

## Task 12 — ResultsLayer (BestRouteBanner, RouteCard, RouteDetail)

**Files (new):**
`frontend/src/components/results/ResultsLayer.tsx`,
`.../BestRouteBanner.tsx`, `.../RouteCard.tsx`, `.../RouteDetail.tsx`
(+ tests).

- `BestRouteBanner`: "Recomendada" (badge) + `ScoreGauge` (compact) + summary
  `formatDistance`/`formatDuration` + `buildRecommendation` text in Spanish.
  CTA "Nueva búsqueda".
- `RouteCard`: number (1..N) aligned with map layer numbering; mini-stats:
  distancia, duración, lluvia máx. (`%`), viento máx. (`km/h`), índice
  (`88/100`); expand/collapse chevron; `aria-expanded`; active/selected state
  highlights border; clicking selects the route (map cross-highlight both
  directions).
- `RouteDetail` (progressive disclosure, per §4.4): ScoreGauge + FactorList +
  SegmentStrip + partial-per-route warnings; rendered on mobile as a `Sheet`
  (Task 5), on desktop as an in-panel expansion.
- `ResultsLayer`: orchestrates banner + list + expansion; renders the spec's
  explicit `partial` states with an informative banner:
  - `weatherAvailable: false` → "No hay previsión meteorológica para esa
    fecha — máximo 7 días." (routes still listed, weather stats omitted).
  - `routeAvailable: false` → "El servicio de rutas no está disponible
    temporalmente."
  - idle/empty → nothing visible (welcome handled by App, Task 15);
    loading → `LoadingState`; error → `ErrorState` (props forwarded from App).
- Component tests: selected card ↔ select callback; banner uses
  `buildRecommendation`; both partial banners render by flag.

**Gate:** frontend gate.

# Fase 3 — Planner + App flip

## Task 13 — Planner pickers

**Files (new):**
`frontend/src/components/planner/ActivityPicker.tsx`,
`frontend/src/components/planner/TimeOptions.tsx`,
`frontend/src/components/planner/AdvancedOptions.tsx`,
`frontend/src/components/planner/OriginDestinationFields.tsx` (+ tests).

- `ActivityPicker`: 5 icon options — Caminar (`FaWalking`), Correr
  (`FaRunning`), Bici (`FaBiking`), Moto (`FaMotorcycle`), Coche (`FaCar`).
  Grid of pressable icon chips (`aria-pressed`, ≥40px targets), value = the
  backend `ActivityType` enum string; test: selection + keyboard.
- `TimeOptions`: `SegmentedControl` of `TIME_PRESETS` (Ahora / Hoy 18:00 /
  Mañana 08:00) + a "Personalizar" option that reveals `AdvancedOptions`; emits
  a UTC ISO departure. Uses `lib/time.ts`.
- `AdvancedOptions`: collapsed (`<details>`/collapsible, "Opciones avanzadas")
  native `date` + `time` inputs (min = today, max = today+7 — clamp enforces
  P10/P6 UX), "Duración máx." number input (optional, 1–1440). Tests: default
  dynamic date, max enforced by `maxDate`.
- `OriginDestinationFields`: Desde / Hasta `Field`+`TextInput`, validated on
  blur and at submit; sibling button "Usar mi ubicación" (`FaLocationArrow`)
  — renders but is disabled/no-op until Task 21 wires geolocation +
  reverse-geocode; autocomplete affordance reserved (arrow-down hint) and
  wired in Task 21. Tests: blur validation shows inline errors  with
  `aria-describedby`/`aria-invalid`.

**Gate:** frontend gate.

## Task 14 — PlannerForm

**Files (new):** `frontend/src/components/planner/PlannerForm.tsx` (+ test).

- zod schema: origin/destination required; activity enum; departure (from
  presets or advanced inputs) required; maxDuration optional `1..1440`.
- Compose Tasks 13 pickers + primitives; on submit:
  1. zod validate (custom zod messages in Spanish);
  2. `resolvePlace` origin + destination (parallel via
     `Promise.allSettled`) — on failure, field error "No encontramos ese
     lugar. Prueba otra ciudad o un nombre más concreto.";
  3. emit `onSearch({ origin, destination, originPoint, destinationPoint,
     activity, departureTime (UTC ISO), maxDurationMinutes })`.
- Submit button = `Button` with loading spinner + "Buscar ruta"; disables while
  a search is pending; progress kept on error (data preserved).
- Tests: valid submit resolves both places then emits; one place unresolved →
  field error, no submit; chips change departure; advanced toggle reveals
  inputs and clamps date to +7 days (mock `Date.now`).

**Gate:** frontend gate.

## Task 15 — App flip (shell integration) + delete legacy

**Files:** `frontend/src/App.tsx` (rewrite), new
`frontend/src/layouts/AppShell.tsx` (wire Tasks 5–14), DELETE
`frontend/src/components/{RouteForm,RouteResults,RouteMap,ComparisonTable,
RiskBreakdown,WeatherTimeline}.tsx` + their tests (`RouteForm.test.tsx`,
`RiskBreakdown.test.tsx`), UPDATE `frontend/src/App.test.tsx`.

- `App`: single source of state:
  - `status: "idle" | "loading" | "error" | "full" | "partial"`;
  - `result: RouteAnalysisResponse | null`, `last: AnalyzeRequest | null`,
    `selectedRouteId: number | null`, `expandedRouteId: number | null`;
  - React Query `useMutation(analyzeRoute)`.
- Layout shell: `<Header/>` fixed; `<MapCanvas/>` absolute behind; left panel
  (desktop `≥1024`, 400–440px) with `PlannerSheet`; mobile = full map with
  floating `PlannerSheet` bottom sheet maximizable; `ResultsLayer` floating
  list above bottom edge; toasts/History/About surface via Header (wired in
  Fase 4).
- State transitions:
  - idle → welcome `EmptyState` overlay on the map (clean slate, brand).
  - submit → `loading` (`LoadingState` route-card skeleton), keep last query on
    `error` for "Reintentar".
  - success → `full`/`partial` per `result.status`; show `ResultsLayer`;
    auto-select best route → center map `fitBounds`.
- Commit message families: `feat: App map-centric shell (PlannerSheet +
ResultsLayer)`; then `chore: remove legacy form UX components` (deletes the
  four duplicated-color/label sources: `riskColor`, `riskBadge`, `toColor`,
  english recommendation — verify none remain via grep).
- `App.test.tsx` rewrite: legacy flows replaced —
  - error path: type Desde/Hasta → "Buscar ruta" → 503 fetch → alert +
    "Reintentar" re-send;
  - success path: mock 200 analysis → banner "Recomendada" visible, cards in
    Spanish, `Índice de condiciones` rendered, map stub (Task 8 stub) used;
  - map-centric: map visible by default, welcome `EmptyState` before first
    search.
- Grep gate: `grep -rn "riskColor\|riskBadge\|toColor\|Analizar ruta" frontend/src`
  must return nothing after this task.

**Gate:** frontend gate.

# Fase 4 — Advanced UX

## Task 16 — Debounced auto re-analysis

**Files:** `frontend/src/App.tsx` (edit), new
`frontend/src/hooks/useDebouncedCallback.ts` (+ test),
`frontend/src/components/results/RefreshingIndicator.tsx` (+ test).

- `useDebouncedCallback(fn, delay)`: returns a stable callback that debounces
  (default 400ms) and cancels pending invocations on unmount.
- In App: after a successful analysis, changing only the *committed*
  departure (preset/advanced) or activity triggers a debounced re-analysis
  with the same resolved origin/destination. Rules:
  - never fires while a mutation is pending;
  - never fires on origin/destination text edits (only on new committed
    geocoded values);
  - keeps current results visible with a subtle `RefreshingIndicator`
    ("Actualizando…") and replaces them atomically on success (also updates
    history entry);
  - errors during auto-refresh → toast (Task 17), previous results retained.
- Tests: debounce fires once on rapid changes; guards (pending + text edit)
  block it; indicator shows while pending.

**Gate:** frontend gate.

## Task 17 — Toasts

**Files (new):** `frontend/src/components/ui/Toast.tsx`, `ToastList.tsx`,
`frontend/src/hooks/useToasts.ts` (+ tests).

- `useToasts`: context provider + `useToasts()` → `addToast(kind, message)`;
  kinds error/warning/info/success; auto-dismiss 5s; id via `useId`/counter.
- `ToastList`: fixed stack (desktop bottom-right, mobile top); `role="status"`
  for info, `role="alert"` for errors; close button; `aria-live="polite"`.
- Wire into App: analysis errors, partial-info notices, geolocation failures
  (Task 21), auto-refresh errors (Task 16).
- Tests: toast appears and auto-dismisses (fake timers); error toast has
  `role="alert"`; close removes.

**Gate:** frontend gate.

## Task 18 — HistorySheet

**Files (new):** `frontend/src/lib/storage.ts` (+ test),
`frontend/src/hooks/useRecentSearches.ts` (+ test),
`frontend/src/components/history/HistorySheet.tsx`, `.../HistoryItem.tsx`
(+ tests).

- `lib/storage.ts`: safe localStorage wrapper (try/catch, JSON), key
  `weatherroute:history`; entry `{ id, origin, destination, activity,
  departureTimeUtc, maxDurationMinutes, savedAt }`; helpers add/list/remove/
  clear; cap 10, dedupe by (origin, destination, activity, departureTimeUtc).
- `useRecentSearches`: lazy-load on first render (tests mock localStorage);
  `save(search)`, `remove(id)`, `clear()`.
- `HistorySheet`: `Sheet` listing recent analyses as `HistoryItem` (icons +
  origin→destination, activity label, `formatSavedAt` relative time); click →
  re-run (fills planner + triggers search, restores from `lastRequest`); trash
  deletes an entry; empty state "Aún no hay búsquedas guardadas".
- Wire into App: save a history entry after each *successful* analysis.
- Tests: localStorage read/write round-trip; dedupe + cap; sheet renders items,
  re-run callback, delete; empty state.

**Gate:** frontend gate.

## Task 19 — AboutModal ("Cómo funciona")

**Files (new):** `frontend/src/components/about/AboutModal.tsx` (+ test).

- Opens from Header "Cómo funciona" and ScoreGauge "¿Cómo se calcula?".
- `Sheet`/dialog content: what WeatherRoute is; how the score works (índice de
  condiciones 0–100, más alto = mejor; what impacts it — factors list from
  `FACTOR_META`, `weightLabel`); free-sources vision: OpenStreetMap +
  OpenFreeMap tiles, Open-Meteo weather, OpenRouteService free profile; "sin
  registro, sin pagos"; disclaimer forecast ≤7 días.
- Tests: opens, focus trap + Esc close, copy in Spanish, ScoreGauge help link
  focuses it.

**Gate:** frontend gate.

# Fase 5 — Backend extension + autocomplete/geolocation

## Task 20 — Backend geocode search + reverse (+ UTC/local contract test)

**Files:**
- New `backend/WeatherRoute.Application/Ports/Out/IGeocodingDiscoveryProvider.cs`
- New `backend/WeatherRoute.Application/Dtos/GeocodingCandidate.cs`
- Edit `backend/WeatherRoute.Infrastructure/Routing/OpenRouteServiceRoutingAdapter.cs`
- Edit `backend/WeatherRoute.Api/Endpoints/RouteEndpoints.cs`
- Edit `backend/WeatherRoute.Api/Program.cs`
- Tests: edit `tests/WeatherRoute.Infrastructure.Tests/OpenRouteServiceRoutingAdapterTests.cs`, new `tests/WeatherRoute.Infrastructure.Tests/WeatherTimeContractTests.cs`

Spec background: current `GET /api/geocode` returns only the first coordinate
(T4). Extension keeps it working and adds list + reverse.

1. **DTO** — `public sealed record GeocodingCandidate(string Label, double
   Latitude, double Longitude, IReadOnlyList<double>? BoundingBox = null);`
2. **Port (Application, no externals):**
   ```csharp
   public interface IGeocodingDiscoveryProvider
   {
       Task<IReadOnlyList<GeocodingCandidate>> SearchAsync(string query, CancellationToken ct = default);
       Task<string?> GetPlaceNameAsync(double latitude, double longitude, CancellationToken ct = default);
   }
   ```
3. **Adapter** — `OpenRouteServiceRoutingAdapter` also implements
   `IGeocodingDiscoveryProvider` (single concrete class registered per
   interface, following the existing Program.cs factory pattern):
   - `SearchAsync`: `GET /v2/geocode/search?text={q}` (same Authorization
     header); parse `features[]` → `properties.label`, `geometry.coordinates`
     `[lon,lat]`, optional `bbox` (4 doubles); return list (empty list when no
     features — no throw), first 6 candidates.
   - `GetPlaceNameAsync`: reverse `GET
     /v2/geocode/reverse?point.lon={lon}&point.lat={lat}&size=1` → first
     `properties.label` or `null`.
4. **Endpoints** (`RouteEndpoints.cs`):
   - `GET /api/geocode/search?q=` → `200 { query, candidates: [...] }`
     (empty `candidates` when none; `400` when q blank).
   - `GET /api/reverse-geocode?lat=&lon=` → `200 { label }` (`label: null` when
     none; `400` on invalid/missing coords).
   - Improve `GET /api/geocode`: wrap `GeocodeAsync` in
     `try { … } catch (GeocodingException) { return Results.NotFound(new
     { error = "no_results" }); }` so the frontend (Task 9's `geocodePlace`,
     now fine-grained) can distinguish "place not found" from server errors.
5. **DI** (`Program.cs`): add factory registration:
   ```csharp
   builder.Services.AddSingleton<IGeocodingDiscoveryProvider>(sp =>
   {
       var options = sp.GetRequiredService<IOptions<OpenRouteServiceOptions>>().Value;
       return new OpenRouteServiceRoutingAdapter(sp.GetRequiredService<IHttpClientFactory>().CreateClient("ors"), options);
   });
   ```
6. **UT contract test** (fixes T4, documents P8 — the timezone "bug" was a
   false positive; no behavior change):
   `WeatherTimeContractTests.cs`: with `timezone=UTC` in the Open-Meteo query
   and the domain using UTC instants, prove that (a) a local departure
   `2026-09-22T18:00` in `Europe/Madrid` (+02:00) equals UTC `16:00`;
   (b) Open-Meteo returns the hourly index for UTC hour 16 (assert adapter
   request URL contains `timezone=UTC`); (c) `toLocaleTimeString("es-ES", …
   )` on that UTC instant yields "18:00" for a Madrid-tz process. This pins
   the contract rather than changing behavior.
7. **Adapter tests** (`OpenRouteServiceRoutingAdapterTests.cs`): add via the
   existing `StubHandler`/`Build` pattern:
   - `SearchAsync` parses `properties.label`, coords and `bbox`; returns
     candidates in order (coordinates already lon/lat, flip to lat/lon in
     DTO);
   - empty features → empty list (no throw);
   - `GetPlaceNameAsync` returns label / `null` when no features; request path
     is the reverse endpoint.
   Backend gate: `dotnet build backend/WeatherRoute.slnx --no-restore
   -warnaserror && dotnet test backend/WeatherRoute.slnx --filter
   "Category!=Integration"`.

**Gate:** backend gate above.

## Task 21 — Autocomplete + "Usar mi ubicación"

**Files:** `frontend/src/types.ts`, `frontend/src/services/api.ts` (edit),
`frontend/src/lib/places.ts` (edit), Planner components
(`OriginDestinationFields.tsx`, `PlannerForm.tsx`) (edit), new
`frontend/src/components/planner/PlaceAutocomplete.tsx` (+ tests).

1. `types.ts`: `interface GeocodingCandidate { label; lat; lon; bbox? }`;
   `types.ts`/`api.ts` add:
   - `searchPlaces(q): Promise<GeocodingCandidate[]>` → `GET /api/geocode/search` (min 2 chars);
   - `reverseGeocode(lat, lon): Promise<string | null>` → `GET /api/reverse-geocode`.
2. `PlaceAutocomplete` (combobox pattern): debounced (250ms) input →
   `searchPlaces`; dropdown ≤6 with `role="listbox"`/`role="option"`, keyboard
   arrows + Enter selects, Esc closes; selection resolves the field to a
   geocoded point (label + coords), which is what `PlannerForm` submits
   (fallback: submit-time `resolvePlace` still validates typed-but-unselected
   text). "No encontramos ese lugar" inline feedback; network error → toast.
3. "Usar mi ubicación" in `OriginDestinationFields` becomes functional:
   `navigator.geolocation.getCurrentPosition` (loading spinner on button,
   `aria-busy`) → `reverseGeocode` → fills label + coords; on
   permission/unavailable failure → toast "No pudimos obtener tu ubicación.
   Revisa los permisos del navegador."; if reverse fails but coords exist,
   fill with "Mi ubicación" + coords so the search still works.
4. `lib/places.ts`: `resolvePlace` now prefers the autocomplete-selected
   `{ label, lat, lon }` and only geocodes raw text otherwise (keeps Task 9
   API).
5. Tests: combobox arrow/enter/Esc behavior; debounce calls `searchPlaces`
   once; selecting an option emits resolved values; geolocation mock fill
   (fake `navigator.geolocation`) + failure toast path.

**Gate:** full backend gate (Task 20) **and** frontend gate — run both after
this task.

# Fase 6 — Polish

## Task 22 — Accessibility pass

**Files:** cross-cutting; touch `App.tsx`, `Header.tsx`, map components,
sheets, planner, results, `frontend/src/index.css`.

Spec §7 to WCAG 2.1 AA:
- Skip-link first element in App ("Saltar al contenido" → `main#contenido`);
  landmarks `header`/`main`/`nav`; heading hierarchy (`h1` marca, `h2` section
  titles, `h3` within RouteDetail).
- `:focus-visible` visible 2px ring on all interactive elements (primitive
  classes already added Task 4; sweep the rest).
- All form errors: `aria-invalid` + `aria-describedby` on the input (done via
  `Field`), plus an `aria-live` region announcing validation/status.
- Risk color never sole channel: `RiskBadge` = icon + text + color — already
  the design; add a contrast assertion test for `RISK_COLORS` text/bg pairs
  (≥4.5:1) if not already in Task 2.
- Touch targets ≥44px (mobile); chips ≥40px.
- `Sheet`s: `role="dialog"` `aria-modal`, initial focus, Esc close, focus trap,
  restore focus on close.
- Map keyboard alternative: routes selectable via cards; popups' info available
  in card text (already true: summary duplicated in cards).
- Wrap non-essential animations in `@media (prefers-reduced-motion:
  no-preference)` (gauge fill, sheet slide, toast slide).
- Tests: add assertions to existing tests (focus ring class on Button, sheet
  Esc/focus, aria-live status region, skip-link first).

**Gate:** frontend gate.

## Task 23 — Final verification + coverage map

- Run the full gates:
  - `cd frontend && npm run typecheck && npm test && npm run build`
  - `dotnet build backend/WeatherRoute.slnx --no-restore -warnaserror`
  - `dotnet test backend/WeatherRoute.slnx --filter "Category!=Integration"`
- Grep QA: no `riskColor|riskBadge|toColor|Analizar ruta|Reintentar` leftovers
  referencing deleted components; `react-icons` imports exist; no English
  risk/factor/condition strings in JSX (all from `i18n/*`).
- Manual smoke against running stack (start backend + `cd frontend && npm run
  dev`): idle welcome → "Usar mi ubicación" auto-fill → "Ahora" → search →
  best banner + cards + map fitBounds → select card ↔ map highlight → expand
  detail → change preset → auto re-analysis → history save/restore → about
  modal → toast on error.
- Coverage map (spec §10 → task):

  | §10 | Mejora | Tarea(s) |
  |---|---|---|
  | 1 | Fundación design system + mapeos i18n/riesgo | 1–6 |
  | 2 | MapCanvas pantalla completa + markers/leyenda/fitBounds | 7–8 |
  | 3 | ScoreGauge condiciones + RiskBadge (modelo mental) | 2, 4, 11–12 |
  | 4 | Localización total a español | 2, 11, 13–14 |
  | 5 | Empty state + header marca/claim | 5–6 |
  | 6 | Chips horarios + límite 7 días + fecha dinámica | 10, 13–14 |
  | 7 | ResultsLayer (sin tabla duplicada) | 12, 15 |
  | 8 | SegmentStrip (sin chart doble-unidad) | 11, 15 |
  | 9 | PlannerSheet responsive mobile-first | 5, 13–15 |
  | 10 | "Usar mi ubicación" (geolocalización) | 20–21 |
  | 11 | Auto re-análisis debounced | 16 |
  | 12 | Autocomplete + backend geocode | 20–21 |
  | 13 | Historial reciente (localStorage) | 18 |
  | 14 | Test contrato horas UTC/local | 20, 3 |
  | 15 | Estados `partial` + toasts | 12, 17 |
  | 16 | Accesibilidad | 22 |
  | 17 | AboutModal "Cómo funciona" | 19 |
  | 18 | "Opciones avanzadas" colapsado | 13–14 |
  | 19 | Microanimaciones + reduced-motion | 1, 22 |
  | 20 | Persistir análisis (`POST /api/routes/analyses`) | out of scope (spec §11) |

- Final: one review cycle (superpowers:requesting-code-review), then
  `docs:`, commit per phase already done; tag `ux-redesign-v1`.

**Gate:** all gates above; verification-before-completion.

---

## Test dependencies (build bottom-up)

1. Task 2 `i18n/*.test` must pass before 11/12 reuse them.
2. Task 5 `Sheet` used by 12, 18, 19.
3. Task 8 maplibre stub reused by App.test (Task 15) and 21 tests.
4. Task 9 `geocodePlace`/`resolvePlace` used by 14; Task 20 keeps the client
   working; Task 21 replaces it with autocomplete-aware resolution.
5. Deferred/blocked: geolocation + autocomplete UX depends on Task 20 backend.