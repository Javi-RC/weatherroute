# WeatherRoute — Rediseño Maps (Fase 1)

- Fecha: 2026-09-28
- Estado: aprobado
- Rama: `feature/maps-layout`
- Supplements: `2026-09-21-weatherroute-design.md`, `2026-09-21-weatherroute-ux-redesign.md`

## 0. Estado de la Fase 1

**Completada** (Tasks 11–24, commits `39ecbd0`→…). Frontend: 442 tests verdes,
`lint`/`typecheck`/`build` limpios. Backend: build `-warnaserror` 0 warnings/errores,
fast suite 123 tests verdes, suite de integración verde (PostgreSQL vía Testcontainers;
el test de contrato ORS se omite sin `OPENROUTESERVICE_API_KEY`).

Shipped diferente de lo planificado (motivo en cada caso):

- **`RouteDetailCard` sobre `MapControlBar`**: se posiciona en `left-4 top-20` en vez de
  `bottom-4 left-4` para no solaparse con la barra de control del mapa en desktop.
- **Override de punto fijado**: el label del punto marcado se muestra/usar solo mientras
  el input de texto está vacío; si el usuario escribe, gana el texto (los inputs dejan de
  desaparecer tras una búsqueda tipada). El marcador se limpia con "Cambiar"/"Nueva búsqueda".
- **Restauración de link**: seedea solo puntos/labels y dispara el análisis; no siembra el
  formulario (`activity`/`departureTime` son estado de `PlannerForm`).
- **`useRouteAnalysis`** (extraído) recibe un arg de efectos (history/toast/selección) y
  `runAnalysis(search, places)` devuelve si hubo request; `samePlaces`/`lastRef` intactos.
- **Sin ruta posible**: se reemplaza el banner "servicio no disponible" por un `ErrorState`
  "No hay ruta posible" con el perfil de actividad (la API devuelve 0 rutas ≠ caída del servicio).
- **Tests**: los clicks de pick se esperan con `await act(async …)` (un `act` síncrono no
  drena el `await reverseGeocode`, el segundo click caería en modo "origen") y `beforeEach`
  resetea `window.history` a `/` (pickear/re-ejecutar escriben la URL).
- **Gate backend**: `tests/` estaba fuera del contexto `#nullable` de `backend/Directory.Build.props`;
  el proyecto `Api.IntegrationTests` usaba anotaciones `?`. Se habilitó `Nullable`+`TreatWarningsAsErrors`
  en ese proyecto y se corrigieron las inconsistencias de nulabilidad latentes en los stubs.
- **Lint**: se añadió `argsIgnorePattern/varsIgnorePattern/caughtErrorsIgnorePattern: "^_"` a
  `@typescript-eslint/no-unused-vars` para que ESLint respete la convención `_`-prefijo del repo.

## 1. Objetivo

Convertir el frontend en un planificador de rutas estilo Google Maps: mapa
dominante y permanente, panel lateral fijo, y **selección de origen/destino
haciendo clic en el mapa**. El mapa deja de ser un soporte pasivo y pasa a ser
la interfaz de entrada.

Hoy el mapa ya es full-bleed con paneles flotantes
(`2026-09-21-weatherroute-ux-redesign.md`, tareas 1–23). Esta fase sustituye ese
layout por el patrón sidebar + mapa, y habilita la interacción que faltaba.

### 1.1 Fuera de esta fase

Se acuerda dividir en fases. Esta spec cubre **solo la Fase 1**.

- **Fase 2** — puntos intermedios (A → B → C) y marcadores arrastrables.
- **Fase 3** — búsqueda a nivel de calle (`/api/geocode/search` con filtro de
  tipo, resultados de vía highlighted, acción "ver en el mapa").

## 2. Decisiones tomadas

| Decisión | Valor | Motivo |
|---|---|---|
| Layout | Sidebar izquierdo fijo de 380px + mapa a la derecha | Patrón Maps/Google Directions. El mapa no queda tapado. |
| Fijar extremos | Modo explícito: barra `Origen` / `Destino` / `+ Vía` | Descubrible y funciona en táctil. Sin marcadores arrastrables (→ Fase 2). |
| Estilo de rutas | Color por riesgo; la seleccionada con casing blanco y el resto al 30% | Conserva la identidad de riesgo de WeatherRoute y se lee cuál está activa. |
| Perfil meteorológico | Gráfico Recharts en la tarjeta de detalle | `recharts` ya es dependencia y no se usa. Da la sensación de "planificador de verdad". |
| Enfoque | Extraer estado a hooks + recomponer layout, reutilizar componentes existentes | No tira los 55 ficheros de test ni la pasada WCAG. |
| Estado en URL | `useUrlState` propio, sin router | Una sola página; añadir `react-router` sería peso muerto. |

## 3. Backend — contrato que habilita el clic

**Domain no se toca. `IRouteProvider` tampoco.** El cambio vive en Api +
Application.

### 3.1 Request

```csharp
// Api/Requests/CoordinatesDto.cs  (nuevo)
public sealed record CoordinatesDto(double Latitude, double Longitude);

// Api/Requests/CalculateRouteRequest.cs
public sealed record CalculateRouteRequest(
    string? Origin,
    string? Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    CoordinatesDto? OriginCoordinates = null,
    CoordinatesDto? DestinationCoordinates = null,
    int? MaxDurationMinutes = null);
```

El JSON gana `originCoordinates` / `destinationCoordinates`. Las peticiones
actuales de texto siguen siendo válidas: **el cambio es aditivo**.

### 3.2 Validación

Por cada extremo, texto **o** coordenadas; nunca ninguno.

```csharp
RuleFor(x => x.Origin).MaximumLength(200).When(x => x.OriginCoordinates is null);
RuleFor(x => x.Destination).MaximumLength(200).When(x => x.DestinationCoordinates is null);
RuleFor(x => x.OriginCoordinates).Must(BeValidOrNull);
RuleFor(x => x.DestinationCoordinates).Must(BeValidOrNull);
RuleFor(x => x)
    .Must(x => x.OriginCoordinates is not null || !string.IsNullOrWhiteSpace(x.Origin))
    .WithMessage("Provide origin or originCoordinates.");
RuleFor(x => x)
    .Must(x => x.DestinationCoordinates is not null || !string.IsNullOrWhiteSpace(x.Destination))
    .WithMessage("Provide destination or destinationCoordinates.");
```

`BeValidOrNull` = `lat` en [-90, 90] y `lon` en [-180, 180]. Se valida aquí (y
no solo en el value object `Coordinates`) para devolver `400` con
`ProblemDetails` en lugar de un `500`.

### 3.3 Command y caso de uso

```csharp
// Application/Ports/In/ICalculateRouteUseCase.cs
public sealed record CalculateRouteCommand(
    string? Origin,
    string? Destination,
    Coordinates? OriginCoordinates,
    Coordinates? DestinationCoordinates,
    ActivityType Activity,
    DateTime DepartureTimeUtc,
    int? MaxDurationMinutes = null);
```

`CalculateRouteUseCase.ExecuteAsync` sustituye las líneas 40-41:

```csharp
var origin      = command.OriginCoordinates      ?? await GeocodeAsync(command.Origin, ct);
var destination = command.DestinationCoordinates ?? await GeocodeAsync(command.Destination, ct);
```

`GeocodeAsync(string? , ct)` es un helper privado que lanza
`GeocodingException` cuando el texto es null/vacío (inalcanzable si el
validador corrió, pero evita un `NullReferenceException`).

Con coordenadas, **cero llamadas a geocodificación**, que es lo que hace
responde instantáneo al picar puntos repetidamente en el mapa.

### 3.4 Clave de caché

`CachedCalculateRouteUseCase.BuildKey` pasa a distinguir coordenadas de texto y
a redondear:

```csharp
private static string Part(Coordinates? c, string? label) =>
    c is null ? $"t:{label?.ToLowerInvariant()}" : $"c:{c.Latitude:F4},{c.Longitude:F4}";

var raw = string.Join("|",
    Part(command.OriginCoordinates, command.Origin),
    Part(command.DestinationCoordinates, command.Destination),
    command.Activity,
    $"{command.DepartureTimeUtc:o}",
    command.MaxDurationMinutes);
```

`F4` ≈ 11 m: dos clics en la misma calle reutilizan la entrada. El prefijo
`t:`/`c:` evita que un texto y unas coordenadas colisionen.

### 3.5 Endpoint de persistencia

`POST /api/routes/analyses` (`RouteEndpoints.cs:74-75`) hoy geocodifica los
strings. Se extiende igual que `analyze` —mismo validador, misma clave de
caché— para no dejarlo como una trampa. El frontend no lo consume.

## 4. Frontend — arquitectura

Enfoque 2: se extrae el estado a hooks y se recompone el layout. Se reutilizan
los 15 primitivos de `components/ui/`, `PlaceAutocomplete` con su ARIA,
`ActivityPicker`, `TimeOptions`, `AdvancedOptions`, `ScoreGauge`, `FactorList`,
`SegmentStrip`, `HistorySheet`, `AboutModal`, los formatters `es-ES` y
`i18n/risk.ts`.

### 4.1 Layout

```
┌────────────────────────────────────────────────────────────────┐
│ ▓ WeatherRoute                          A  [Buscar]  ?  ⓘ      │  h-16
├──────────────────┬─────────────────────────────────────────────┤
│ PLANIFICADOR     │ [Origen][Destino][+ Vía]  ⟳Ajustar   ⊕ ⊖ 🧭 │  h-14
│ ┌──────────────┐ │                                             │
│ │ Origen    A ●┼─┼──╮         ╭───╮                            │
│ │ Destino   B ●┼─┼──╰─────────╯   ╰───╮   MAPA                 │
│ └──────────────┘ │     ruta 1 verde ╭──╮   ruta 2 ámbar        │
│ Actividad 🚴🏍️🚗 │                ╰──╯                           │
│ Salida  [Ahora ▾]│                                             │
│ [ Buscar ruta ]  │                                             │
├──────────────────┤      ┌────────────────────────────────┐     │
│ RUTAS            │      │ Ruta 1 · 88/100 · 14 km 52min │     │
│ ▸ 1 ████░ 88/100 │      │ [Temp|Lluvia|Viento]  ╱▔▔╲     │     │
│   2 ██░░░ 72/100 │      │ Factores · Tramo a tramo        │     │
│   3 █░░░░ 55/100 │      └────────────────────────────────┘     │
│ historial ▾      │                                             │
└──────────────────┴─────────────────────────────────────────────┘
   380px (lg) / 400px (xl)     flex-1, min-w-0
```

- `>= lg` (1024px): `flex`. Sidebar `w-[380px] xl:w-[400px] shrink-0
  border-r`, mapa `flex-1 relative min-w-0`. Un solo `overflow-y-auto` en el
  sidebar.
- `< lg`: patrón actual de `PlannerSheet` — FAB + bottom sheet. El mapa queda
  full-bleed.
- Se elimina la clase `isCompact` duplicada con breakpoint distinto
  (`RouteDetail.tsx:17` usa 768px, `App.tsx:32` usa 1024px). **Un único
  breakpoint: 1024px**, definido en un solo sitio.

### 4.2 Componentes nuevos

| Fichero | Responsabilidad |
|---|---|
| `components/layout/Sidebar.tsx` | Columna izquierda. Formulario arriba, `RouteList` + historial abajo, un solo scroll. |
| `components/map/PickModeBar.tsx` | `role="toolbar"` sobre el mapa con `Origen` / `Destino` / `+ Vía` (`+ Vía` deshabilitado, Fase 2) y `aria-pressed` en el activo. |
| `components/map/RouteDetailCard.tsx` | Tarjeta flotante sobre el mapa con `ScoreGauge`, `RouteProfileChart`, `FactorList`, `SegmentStrip`. |
| `components/map/MapControlBar.tsx` | Botón "Ajustar vista" + leyenda de riesgo + escala. |
| `components/results/RouteList.tsx` | Extraído de `ResultsLayer`: `BestRouteBanner` + lista de `RouteCard` con navegación por flechas. |
| `components/results/RouteProfileChart.tsx` | Gráfico Recharts del perfil meteorológico. |
| `hooks/useUrlState.ts` | Estado ⇄ query string. |
| `hooks/useRouteAnalysis.ts` | Máquina de estados del análisis (extraída de `App.tsx`). |

`App.tsx` pasa de 327 líneas de estado a composición de ~120.

### 4.3 Capas del mapa

`lib/map.ts:buildRouteFeatures` añade `selected: boolean` a cada feature. Se
sustituyen las dos capas actuales por tres:

| Layer | Pintado | Filtro |
|---|---|---|
| `route-casing` | `line-color` `#ffffff`, `width` 9, `line-join` round | `["==", ["get", "selected"], true]` |
| `route-hover` | `line-color` `#ffffff`, `width` 7, `opacity` 0.7 | `["==", "$id", hoveredId]` |
| `route-lines` | `line-color` `["get", "color"]`, `width` 5 | — |
| `route-lines` opacidad | `["case", ["get", "selected"], 1, 0.3]` | — |

`["case", ["get", "selected"], 1, 0.3]` sustituye a la capa `route-selected` y
al `setFilter` por `routeIndex`.

El padding de `fitBounds` pasa a asimétrico para no meter la ruta bajo el
sidebar: desktop `left: 412, right: 32, top: 32, bottom: 32` (412 = 380 + 32).

## 5. Interacción

### 5.1 Seleccionar extremos

`MapCanvas` gana `pickMode: "none" | "origin" | "destination"` y
`onPickPoint(point: GeoPoint)`.

- Un único handler `map.on("click")`. Consulta
  `map.queryRenderedFeatures(e.point, { layers: ["route-lines"] })`; si hay
  resultados, el clic fue sobre una ruta → seleccionar ruta, no colocar punto.
- Si no hay resultados y `pickMode !== "none"` → `onPickPoint`.
- Cursor: `crosshair` en el mapa cuando `pickMode !== "none"`; `pointer`
  sobre `route-lines` vía `mousemove` de capa.
- Flujo: al entrar por primera vez, `pickMode` es `"origin"`. Al colocar el
  origen, avanza solo a `"destination"`. Al colocar el destino, vuelve a
  `"none"`.
- El clic dispara `GET /api/geocode/reverse` para nombrar el punto. Si falla o
  devuelve null, el punto se conserva y la etiqueta pasa a
  `"Punto 40,4168 / -3,7038"` (formato `es-ES`, 4 decimales). **El clic nunca
  se pierde por un fallo de red.**

### 5.2 Cámara

El mapa **nunca se mueve solo**. Se elimina el `fitBounds` de `paint()` (que
hoy se dispara en cada cambio de prop y destruye el paneo manual del usuario).

`MapCanvas` expone un handle imperativo:

```ts
export interface MapCanvasHandle {
  fitToRoutes(): void;
  ensureVisible(point: GeoPoint): void;
}
```

- `useEffect` en `App` → `fitToRoutes()` cuando cambia `analysisRunId`.
- `ensureVisible(point)` al colocar un extremo: hace `easeTo` solo si el
  punto queda fuera del viewport actual.
- Botón "Ajustar vista" → `fitToRoutes()` explícito.
- No hace falta seguir el gesto del usuario: la decisión de encuadrar es
  enteramente de `App`.

### 5.3 Estado en URL

`useUrlState` sincroniza con `history.replaceState` (sin router) y escucha
`popstate`.

| Param | Contenido |
|---|---|
| `o` / `ol` | `lat,lng` / etiqueta del origen |
| `d` / `dl` | `lat,lng` / etiqueta del destino |
| `a` | `Walking` \| `Running` \| `Cycling` \| `Motorcycle` \| `Driving` |
| `t` | `departureTime` ISO UTC |
| `max` | duración máxima en minutos |
| `r` | índice de la ruta seleccionada |
| `z`, `lat`, `lon` | cámara |

- Al cargar, si `o` y `d` están presentes: se restaura el estado y **se lanza
  el análisis automáticamente**.
- Si `z` está presente, `jumpTo` en el evento `load`; si no, vista mundo.
- La cámara se escribe con `useDebouncedCallback` (500 ms) sobre `moveend`.
  `replaceState`, nunca `pushState` — el historial del navegador no se llena.
- Valores malformados se ignoran silenciosamente (no rompen la app).

### 5.4 Datos enviados

Si hay punto fijado para un extremo, se envían sus coordenadas **y** su
etiqueta (la etiqueta se usa para la persistencia y la URL):

```json
{
  "origin": "Madrid",
  "originCoordinates": { "latitude": 40.4168, "longitude": -3.7038 },
  "destination": "Toledo",
  "destinationCoordinates": { "latitude": 39.8628, "longitude": -4.0273 },
  "activity": "Cycling",
  "departureTime": "2026-09-28T08:00:00Z"
}
```

Si el extremo viene solo de texto, se envía solo `origin`/`destination` y el
backend geocodifica, como hoy.

## 6. Perfil meteorológico

`RouteProfileChart` (Recharts `ComposedChart`, 150px):

- Eje X = distancia acumulada, derivada sumando `segments[].distanceKm`.
- Eje Y = **una métrica a la vez**, elegida con `SegmentedControl`:
  `Temperatura` (línea, °C) · `Lluvia` (barras, %) · `Viento` (línea, km/h).
- `Tooltip` muestra siempre las tres métricas más la hora de llegada.
- `hoveredSegmentIndex` en `App`: al pasar el ratón por el punto activo se
  renderiza un marcador-sonda en `polyline[segment.fromIndex]` del mapa.
- Accesible: `role="img"` con `aria-label` resumen, y `SegmentStrip` se
  mantiene como la versión lineal de los mismos datos.

## 7. Errores y estados

| Situación | Comportamiento |
|---|---|
| `routes.length === 0 && !routeAvailable` | `ErrorState`: "No hay ruta posible entre estos puntos con el perfil *{actividad}*. Prueba a mover los extremos o a cambiar de actividad." + reintentar. Es el caso real de ORS 400 (p. ej. entre continentes) y hoy se ve como una lista vacía sin explicación. |
| Origen/destino sin resolver al enviar | Error de campo por campo (comportamiento actual de `PlannerForm`). |
| `reverse` falla tras un clic | El punto se conserva; etiqueta = `"Punto lat, lng"`. |
| Error de red | `Toast` + `ErrorState` con reintento. |
| Proveedor de ruta o meteorología caído | `status: "partial"` con banner (comportamiento actual). |

## 8. Responsive y accesibilidad

- Breakpoint único **1024px**, en un solo módulo.
- `PickModeBar` con `role="toolbar"`, `aria-pressed` en el modo activo y
  navegación por flechas.
- Región `aria-live="polite"` que anuncia "Origen fijado en Madrid",
  "Destino fijado en Toledo", "Ruta 2 seleccionada".
- **El clic en el mapa es una mejora, nunca el único camino**: el sidebar
  mantiene `PlaceAutocomplete` con su combobox ARIA completo. Quien no pueda
  usar el ratón tiene el mismo resultado por teclado.
- `RouteList` con roving tabindex: flechas mueven la selección, `Enter`
  confirma.
- Botón "Ajustar vista" con etiqueta explícita.
- Se conserva la pasada WCAG 2.1 AA existente: skip-link, foco visible,
  objetivos táctiles `min-h-11`, `motion-safe`, `prefers-reduced-motion`.

## 9. Testing

### 9.1 Backend

- `CalculateRouteRequestValidatorTests` (nuevo) — coordenadas solas ✓, texto
  solo ✓, ninguno ✗, lat/lon fuera de rango ✗.
- `CalculateRouteUseCaseTests` — con coordenadas, el fake de geocodificación
  **no** se llama; sin coordenadas, se llama.
- `CachedCalculateRouteUseCaseTests` — mismas coordenadas con etiquetas
  distintas → misma clave; coordenadas que difieren en el 5º decimal → misma
  clave; `t:` ≠ `c:`.
- Integración Api — `POST /api/routes/analyze` con coordenadas → `200` con
  rutas.
- Los tests de contrato existentes que asuman el request de texto se
  actualizan.

### 9.2 Frontend

`test/stubs/maplibre.ts` es un contrato: se amplía **antes** de escribir los
tests, con `queryRenderedFeatures`, `getCanvas`, `getCenter`, `getZoom`,
`easeTo`, `jumpTo`, `setPaintProperty`, `removeLayer`, `ScaleControl`,
`GeolocateControl`, `dragPan`. Si no, se rompen los tests de `MapCanvas` y
`App` en cascada.

- `useUrlState.test.ts` — round-trip encode/decode, parámetros malformados
  ignorados, `popstate`, `replaceState` en vez de `pushState`.
- `useRouteAnalysis.test.ts` — con puntos fijados se envían coordenadas; con
  texto se envían etiquetas; el debounce de re-análisis sigue funcionando;
  `intentRef` ignora respuestas obsoletas.
- `MapCanvas.test.tsx` (reescrito) — vista mundo por defecto; source y tres
  capas; clic en ruta selecciona; clic en zona vacía con `pickMode` coloca
  punto; clic sin `pickMode` no hace nada; cursor; casing y opacidad según
  `selected`; sonda en `fromIndex`; `fitToRoutes` solo vía handle; no se
  re-encuadra al re-renderizar; limpieza en unmount.
- `RouteProfileChart.test.tsx` — cambio de métrica, tooltip con las tres.
- `RouteList.test.tsx` — navegación por flechas.
- `PickModeBar.test.tsx` — `aria-pressed` y avance automático de modo.
- `AppShell.test.tsx` y `App.test.tsx` — reescritos para el layout flex y el
  flujo de clic.

Puertas de verificación (CI parity, de `AGENTS.md`):

```bash
dotnet build backend/WeatherRoute.slnx --no-restore -warnaserror
dotnet test backend/WeatherRoute.slnx --filter "Category!=Integration"
# y desde frontend/:
npm run typecheck && npm test && npm run build
```

## 10. Fuera de alcance

- Puntos intermedios y marcadores arrastrables (Fase 2).
- Búsqueda a nivel de calle (Fase 3).
- Altura/elevación del perfil (ORS lo da, pero no está en el contrato actual).
- Persistencia de los análisis en el frontend (`POST /api/routes/analyses`).
- Autenticación, multi-idioma, PWA.
