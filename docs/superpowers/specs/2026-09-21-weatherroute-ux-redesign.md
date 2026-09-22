# WeatherRoute — UX/UI Redesign Spec

- Fecha: 2026-09-22
- Estado: aprobado por el usuario
- Alcance: frontend completo (+ una ampliación mínima de backend para geocode)
- Producto de referencia: `docs/superpowers/specs/2026-09-21-weatherroute-design.md`

## 0. Resumen

WeatherRoute es un *weather-aware route planner*: dadas origen, destino,
actividad y hora de salida devuelve hasta 2 rutas candidatas con distancia,
duración y un **índice de condiciones** (0–100) explicable, impulsado por el
pronóstico a lo largo de la ruta. Sin cuentas, sin pagos.

El frontend actual es un MVP funcional de una sola pantalla
(formulario → resultados apilados) que no comunica el valor del producto.
Está centrado en el formulario en lugar de en el mapa, mezcla idiomas,
duplica información, malinterpreta su propio score y carece de design system,
estados de bienvenida, historial y accesibilidad básica.

**Decisión rectora (confirmada con el usuario):** el producto debe sentirse
como **"un Google Maps mundial, gratis, sin API keys"**. Por tanto, el
rediseño cambia el paradigma de *app centrada en formulario* a *app centrada
en mapa*: el mapa es el lienzo permanente, tipo Google Maps, y el formulario /
los resultados flotan sobre él como panel (desktop) o hojas inferiores (móvil).

Decisiones confirmadas:
- **Multi-superficie**: sin router profundo; micro-superficies (sheets,
  modales, expansiones) sobre un mapa permanente. Deeplink a detalle de ruta
  como opción futura.
- **Mobile-first**: la experiencia móvil es la prioritaria.
- **Todo en español**: niveles, factores de riesgo, condiciones y
  recomendación se muestran en español (mapeo en frontend).

## 1. Problemas actuales (síntesis de la auditoría)

### 1.1 Funcional/UX
- P1 La app es formulario-centrada; el mapa (activo clave) está oculto bajo
  una página de tablas y centrado por defecto en Andorra.
- P2 El score se lee al revés: `68/100 · Moderate` se percibe como "68% de
  riesgo" cuando realmente significa "condiciones 68/100" (score = 100 −
  penalización, más alto = mejor).
- P3 Sin empty state ni identidad de marca: se ve un formulario desnudo.
- P4 Información triplicada: tabla de tramos + gauge + línea temporal por cada
  ruta + tabla comparativa → sobrecarga cognitiva.
- P5 Idioma mezclado: UI en español, niveles/factores/recomendación en inglés.
- P6 Pronóstico fuera de rango (fecha > ~7 días) falla en silencio
  (`status: partial` no se comunica).
- P7 Sin autocomplete: si un lugar no geocodifica, el error llega tarde y
  genérico.
- P8 Bug de zona horaria: la hora local se envía como UTC
  (`App.tsx:20`), así que la previsión se consulta ~1–2 h desfasada respecto a
  la hora que ve el usuario.
- P9 Sin historial ni reutilización de búsquedas.
- P10 Fecha por defecto hardcodeada (`2026-09-27`) que queda obsoleta.

### 1.2 Técnico/consistencia
- T1 Color de riesgo duplicado en 3 sitios: `riskColor` (RouteResults),
  `riskBadge` (ComparisonTable) y `toColor` (RouteMap).
- T2 Sin design tokens: solo `@import "tailwindcss"` en `index.css`; colores
  hardcodeados sueltos.
- T3 `react-icons` instalado y sin usar.
- T4 `GET /api/geocode` devuelve solo la primera coordenada; no sirve para
  autocomplete.
- T5 `WeatherTimeline` usa un chart de doble unidad (temp °C + lluvia %) sobre
  un mismo eje oculto → engañoso.

### 1.3 Accesibilidad / responsive
- A1 Badges de riesgo dependientes solo del color; contraste débil de
  `amber-800/amber-100`.
- A2 Sin `:focus-visible`, sin skip-link, errores sin `aria-describedby`,
  mapa no operable por teclado, sin `prefers-reduced-motion`.
- A3 En móvil, las tablas internas de tramos se comprimen (falta `overflow-x`
  en la tabla de segmentos dentro de las cards) y la página es kilométrica.

## 2. Arquitectura UX objetivo

```
WeatherRoute (single-page, mapa permanente)
├── Header
│   ├── Marca: "WeatherRoute" + claim "Meteo en tu ruta, gratis, en cualquier
│   │           lugar del mundo"
│   ├── Badge "Gratis · Sin registro"
│   └── Acciones: "Cómo funciona" (modal) · Historial (sheet)
├── MapCanvas                         ← lienzo permanente (MapLibre, mundo OSM gratis)
│   ├── Capa de rutas por riesgo + leyenda de riesgo
│   ├── Markers de origen/destino · popup de resumen de ruta
│   └── Interacción: click en línea → resalta card; fitBounds
├── PlannerSheet (desktop=panel / mobile=hoja inferior)
│   ├── Paso 1 · Buscar: [Desde][Hasta] + "usar mi ubicación" + autocomplete
│   ├── Paso 2 · Actividad: ActivityPicker (iconos) + chips horario
│   │           (Ahora / Hoy 18:00 / Mañana 08:00)
│   ├── Paso 3 · Avanzado (colapsado): fecha/hora nativos + duración máx.
│   └── Acción: "Buscar ruta" + auto re-análisis (debounce) al cambiar
│       actividad/fecha/hora
├── ResultsLayer
│   ├── BestRouteBanner: "Recomendada" + resumen + índice de condiciones
│   ├── RouteList: N RouteCards (mini-stats) — click ancla el mapa
│   └── RouteDetail (expansión): mapa enfocado + ScoreGauge + factores
│       + SegmentStrip
├── HistorySheet                      ← localStorage, análisis recientes
└── AboutModal                        ← qué es, cómo se puntúa, fuentes gratis
```

### Journeys rediseñados
1. **Comprobación rápida**: abrir → "Usar mi ubicación" → "Ahora" → rutas en
   mapa → "Recomendada". ~4 toques sin teclear.
2. **Viaje concreto**: buscar A→B → actividad → fecha/hora → comparar cards →
   expandir detalle por tramo → confirmar.
3. **Vuelta**: abrir historial → re-ejecutar.

## 3. Definiciones de producto

### 3.1 Índice de condiciones (reemplazo del score ambiguo)
- El backend devuelve `riskScore` (0–100, más alto = mejores condiciones) y
  `riskLevel` (Low/Moderate/High/Severe). El frontend **no cambia el backend
  de esto**.
- Presentación en UI:
  - **Índice de condiciones**: gauge / número "88/100" + etiqueta
    ("Muy buenas", "Buenas", "Aceptables", "Malas").
  - **Nivel de riesgo**: badge independiente ("Riesgo bajo/moderado/alto/extremo")
    con icono + color, nunca solo color.
  - Nota de ayuda: "Más alto = mejores condiciones".
- Mapeo de `riskLevel` → español en `frontend/src/i18n/risk.ts`.

### 3.2 Localización (español)
- Niveles: Low→Bajo, Moderate→Moderado, High→Alto, Severe→Extremo.
- Condiciones: Clear→Despejado, Clouds→Nublado, Fog→Niebla, Rain→Lluvia,
  Snow→Nieve, Storm→Tormenta, Unknown→Sin datos.
- Factores (por `factor.type`): WIND→Viento, TEMPERATURE→Temperatura,
  HEAT→Calor, RAIN→Lluvia, STORM→Tormenta, SNOW→Nieve, VISIBILITY→Visibilidad,
  UV→Radiación UV. Cada uno con un icono y, cuando se dispone del valor crudo,
  mensaje en español (p. ej. "Viento 32 km/h").
- **Recomendación**: no se muestra el string inglés del backend; el frontend
  compone la propia en español a partir de los datos (mejor ruta por riesgo/
  duración): "Ruta 2 recomendada: 74 km, 2 h 48 m, condiciones muy buenas".
- Tabla fuente de verdad: `frontend/src/i18n/` (ver §5.3).

### 3.3 Visión "planeta tierra, gratis"
- El mapa es el eje visual (mundo OSM, tiles gratis de OpenFreeMap).
- El claim y el modal "Cómo funciona" comunican gratuidad: OpenStreetMap +
  Open-Meteo + perfil gratuito de OpenRouteService. Sin registro, sin cuentas.

## 4. Rediseño por pantalla

### 4.1 `App.tsx` (shell) — P0
- **Quitar**: `<h1>` suelto, grid de skeletons genérico.
- **Añadir**: `Header`, `MapCanvas` permanente, `PlannerSheet`,
  `ResultsLayer`, `HistorySheet`, `AboutModal`, toasts de error.
- Estados: ciudadano-inicial (empty welcome), loading (skeleton de ruta con
  forma real + etapas opcionales), error (`ErrorState` con reintento y datos
  preservados), `partial` explícito.

### 4.2 `RouteForm` → `PlannerSheet` — P0
- Origen/destino con autocomplete (listo para backend ampliado) + botón
  "usar mi ubicación" (geolocalización del navegador).
- `ActivityPicker` con iconos (react-icons): Caminar, Correr, Bici, Moto,
  Coche.
- Chips horarios "Ahora / Hoy 18:00 / Mañana 08:00" + fecha/hora nativos
  bajo "Avanzado". Fecha por defecto dinámica (hoy/hoy+1) y limitada a +7 días.
- "Duración máx." colapsado bajo "Opciones avanzadas".
- Validación en blur; errores asociados con `aria-describedby`; feedback de
  "no encontramos ese lugar".
- Antes de implementar el autocomplete, el campo se valida al enviar contra
  `GET /api/geocode`.

### 4.3 `RouteMap` → `MapCanvas` — P0
- Mapa a pantalla completa y permanente; vista inicial = mundo (zoom bajo,
  sin centro en Andorra).
- Markers A/B de origen/destino; capa de líneas por riesgo; leyenda de riesgo
  solapada; popup con resumen (distancia/duración/índice).
- `fitBounds` con padding según el layout (más padding vertical en móvil para
  no ocultarse bajo las sheets).
- Click en línea de ruta → resalta la `RouteCard` correspondiente y viceversa.
- Esperar `load`/`style.load` correctamente antes de pintar (eliminar carrera
  actual).

### 4.4 `RouteResults` + `ComparisonTable` → `ResultsLayer` — P1
- **Quitar**: la tabla de tramos por ruta, la `ComparisonTable` como elemento
  independiente, y el detalle exhaustivo visible por defecto.
- **Añadir**: `BestRouteBanner` ("Recomendada" + Índice de condiciones +
  resumen), `RouteList` de `RouteCard`s con mini-stats (distancia, duración,
  lluvia máx., viento máx., índice) numeradas igual que en el mapa; cada card
  expande `RouteDetail` (progressive disclosure).
- Estados `partial`: banner informativo ("No hay previsión meteorológica para
  esa fecha — máx. 7 días" / "El servicio de rutas no está disponible
  temporalmente"). Botón "Nueva búsqueda".

### 4.5 `RiskBreakdown` → `ScoreGauge` + factor list — P0
- Gauge/barras del **Índice de condiciones** (nunca "riesgo 68/100").
- Lista de factores en español, con icono y peso (+N), tooltip
  "¿Cómo se calcula?", nota "Más alto = mejores condiciones".
- Texto plano de la contribución reemplazado por escala legible ("Gran
  impacto", "Moderado", "Leve") además del n.

### 4.6 `WeatherTimeline` → `SegmentStrip` — P1
- **Quitar** el chart de doble unidad. Sustituir por tiles horizontales por
  tramo: hora de llegada + icono de condición + temperatura + mini-indicador
  de lluvia/viento con tooltip (viento, UV, visibilidad, condición completa).
- En móvil los tiles se apilan; sin scatter lateral.
- Sparkline de temperatura opcional, nunca mezclado con otra unidad.

## 5. Design System

### 5.1 Tokens (Tailwind 4 CSS-first, `@theme` en `index.css`)
- **Colores**: paleta "tierra/océano":
  - Neutros arena: `--color-sand-50..900`.
  - Primario océano: `--color-ocean-50..900` (base teal azulado, p. ej.
    `#0e7490` en la escala teal de Tailwind).
  - Énfasis sol: `--color-sun-*` (amber).
  - Riesgo semántico (fuente única, usada por badge, gauge y mapa):
    `--color-risk-low` (emerald), `--color-risk-moderate` (amber),
    `--color-risk-high` (orange), `--color-risk-severe` (red), con pares
    texto/fondo (p. ej. `--color-risk-low-bg`, `--color-risk-low-text`).
  - Semántica UI: success/warning/danger/info.
- **Tipografía**: `system-ui` stack (sin descarga externa). Escala
  12/14/16/20/24/32/40. Bold para datos clave.
- **Spacing**: base 4 px → 4, 8, 12, 16, 24, 32, 48, 64.
- **Radius**: 6 / 10 / 16 / full.
- **Shadow**: 2 elevaciones (`shadow-card`, `shadow-raise`).
- **Breakpoints**: mobile-first 640 / 768 / 1024 / 1280.
- **Motion**: 150–200 ms; respetar `prefers-reduced-motion`.

### 5.2 Componentes reutilizables (solo los usados en ≥2 lugares)
`Button`, `IconButton`, `Field`, `TextInput`, `Select`, `SegmentedControl`,
`ActivityPicker`, `Badge` (+ `RiskBadge`), `Card`, `ScoreGauge`,
`SegmentStrip`, `MapLegend`, `Sheet`, `EmptyState`, `LoadingState`,
`ErrorState`, `Toast`, `Tooltip`, `ConfirmDialog`, `Header`, `HistoryItem`.
- Cada primitiva: props tipadas, estados rest/hover/focus-visible/pressed/
  disabled/loading, tests de render.

### 5.3 Módulo fuente de verdad de dominio
`frontend/src/i18n/`:
- `risk.ts` — `riskLevelLabel(level)`, `conditionsLabel(score)`, paleta de
  riesgo (importada también por el mapa).
- `factors.ts` — `FACTOR_META` por `type`: label es, icono, peso → "Gran impacto
  / Moderado / Leve".
- `conditions.ts` — `conditionMeta` por enum: label es, icono (react-icons),
  color.
- `recommendation.ts` — generación de la recomendación en español desde datos.
- El mapa importa la paleta desde aquí (fin de la triple duplicación T1).

## 6. Responsive (mobile-first)

| Superficie | Desktop (≥1024) | Tablet (768–1023) | Mobile (<768) |
|---|---|---|---|
| Layout | Mapa permanente + panel 400–440px | Mapa + panel colapsable | Mapa a pantalla completa |
| Navegación | Header fijo + panel | Header compacto | Header mínimo; acciones flotan |
| Planner | Panel izquierdo siempre visible | Panel toggle | Sheet inferior, maximizable |
| Resultados | RouteCards en panel | Igual | Lista en sheet multi-paso |
| Detalle ruta | Expansión 2 columnas | Expansión | Sheet casi completa, scroll |
| Mapa | fitBounds estándar | Igual | fitBounds con padding vertical |
| Acciones | En panel | Igual | "Buscar ruta" y "En el mapa" fixeds |

Principio: el mapa nunca se pierde de vista; nunca hay scroll lateral de tablas.

## 7. Accesibilidad (WCAG 2.1 AA)

- Badges con icono + texto, nunca solo color; contraste ≥4.5:1 (texto `900`
  sobre fondo `100` testeados).
- `:focus-visible` con anillo 2px en todos los interactivos.
- Skip-link, landmarks (`header/nav/main/footer`), jerarquía de headings.
- Errores de formulario con `aria-invalid` + `aria-describedby` + `aria-live`.
- Objetivos táctiles ≥44 px en móvil (chips ≥40 px).
- Sheets con `role="dialog"`, `aria-modal`, foco inicial y cierre con Esc.
- Mapa: teclado operable (mín. enfoque de rutas vía cards), popups con
  alternativa textual en las cards.
- Animaciones envueltas en `@media (prefers-reduced-motion: no-preference)`.

## 8. Backend (dependencia mínima)

- **Ampliar geocode para autocomplete** (único cambio backend obligatorio):
  `GET /api/geocode?q=...` → lista de candidatos `[{ label, lat, lon, bbox? }]`
  (mapear el resultado `features[]` de la respuesta de OpenRouteService).
  Mantener compatibilidad: si no hay `features`, devolver `[]`.
- **Zona horaria**: el frontend enviará (además de `departureTime` UTC como
  hoy) un campo opcional `timeZone` (IANA, de
  `Intl.DateTimeFormat().resolvedOptions().timeZone`). El backend podrá
  usarlo para consultar Open-Meteo con `timezone=<iana>` y alinear las horas
  de la previsión a la hora local del usuario. El envío del campo es parte de
  la Fase 3 (planner); el cambio backend (parámetro opcional + uso en
  Open-Meteo + validación IANA) se agrupa con el trabajo de geocode en la
  Fase 6. No bloquea el resto del rediseño.

## 9. Testing

- Primitivas design system: tests de render/estados en `frontend/src/**/*.test.tsx`.
- `i18n/*`: tests de los mapeos (niveles, factores, condiciones, recomendación,
  paleta) y de consistencia (toda `riskLevel`/`factor.type`/condición conocida
  tiene entrada).
- Seguir con Vitest + Testing Library. Actualizar los tests existentes que
  dependan de strings/jerarquía (`App.test.tsx`, `RouteForm.test.tsx`,
  `RiskBreakdown.test.tsx`).
- Gates por fase (CI parity de AGENTS.md):
  `npm run typecheck && npm test && npm run build` (y `dotnet build/test`
  solo si se toca backend).

## 10. Priorización y roadmap

Relación impacto/esfuerzo (1–5): los de mayor ratio primero.

| # | Mejora | P | Impacto | Esfuerzo | I/E |
|---|---|---|---|---|---|
| 1 | Fundación design system + mapeos i18n/riesgo | P0 | 5 | 3 | 1.67 |
| 2 | MapCanvas pantalla completa + markers/leyenda/fitBounds | P0 | 5 | 2 | 2.50 |
| 3 | ScoreGauge "condiciones" + RiskBadge (modelo mental) | P0 | 5 | 1 | 5.00 |
| 4 | Localización total a español | P0 | 4 | 2 | 2.00 |
| 5 | Empty state + header con marca/claim | P0 | 4 | 1 | 4.00 |
| 6 | Chips horarios + límite 7 días + fecha dinámica | P1 | 4 | 1 | 4.00 |
| 7 | ResultsLayer (BestRouteBanner + RouteList, elimina tabla duplicada) | P1 | 4 | 2 | 2.00 |
| 8 | SegmentStrip (elimina tabla de tramos + chart doble-unidad) | P1 | 4 | 2 | 2.00 |
| 9 | PlannerSheet responsive mobile-first | P1 | 5 | 3 | 1.67 |
| 10 | "Usar mi ubicación" (geolocalización) | P1 | 4 | 2 | 2.00 |
| 11 | Auto re-análisis debounced | P2 | 4 | 2 | 2.00 |
| 12 | Autocomplete + ampliación backend geocode | P2 | 4 | 3 | 1.33 |
| 13 | Historial reciente (localStorage + React Query) | P2 | 3 | 2 | 1.50 |
| 14 | Zona horaria (IANA) correcta | P2 | 4 | 3 | 1.33 |
| 15 | Estados `partial` explícitos + toasts | P2 | 3 | 1 | 3.00 |
| 16 | Accesibilidad (focus, aria, contraste, skip, reduced-motion) | P2 | 3 | 2 | 1.50 |
| 17 | AboutModal "Cómo funciona" (score + gratuidad) | P3 | 3 | 1 | 3.00 |
| 18 | "Opciones avanzadas" colapsado | P3 | 2 | 1 | 2.00 |
| 19 | Microanimaciones + reduced-motion | P3 | 2 | 2 | 1.00 |
| 20 | Persistir análisis (`POST /api/routes/analyses`) | P3 | 2 | 2 | 1.00 |

### Roadmap de implementación

- **Fase 1 — UX Foundations**: design system (tokens `@theme`), primitivas
  (Button, IconButton, Field, TextInput, Badge/RiskBadge, Card, EmptyState,
  LoadingState, ErrorState), módulos `i18n/*` (fuente de verdad), shell de
  `App` (Header + empty welcome). Comité de aceptación: un solo archivo define
  la paleta de riesgo y las traducciones; gates verdes.
- **Fase 2 — Map Canvas**: `MapCanvas` a pantalla completa y permanente;
  markers A/B, leyenda, `fitBounds`, click-select, vista mundo por defecto.
- **Fase 3 — Planner**: `PlannerSheet` responsive; validación con geocode en
  submit; "usar mi ubicación"; chips horarios; fecha +7 días y dinámica;
  "Opciones avanzadas" colapsado; (independiente) corrección de zona horaria.
- **Fase 4 — Results rebuild**: `BestRouteBanner` + `RouteList` + `RouteDetail`;
  `ScoreGauge`; `SegmentStrip`; eliminación de `ComparisonTable`,
  `WeatherTimeline` (chart), `riskColor/riskBadge/toColor` duplicados.
- **Fase 5 — Advanced UX**: auto re-análisis debounced; estados `partial`;
  toasts; `HistorySheet` (localStorage); `AboutModal`.
- **Fase 6 — Autocomplete**: ampliación backend geocode (lista de candidatos) +
  autocomplete en Planner + tests backend/frontend + validación de `timeZone`.
- **Fase 7 — Polish**: accesibilidad completa, microanimaciones con
  reduced-motion, tests finales, verificación con los gates de AGENTS.md y
  commit por paso.

## 11. Fuera de alcance (yagni)

- Autenticación, cuentas, guardado en servidor (el historial local no lo
  requiere).
- Multi-idioma activo (se centraliza en `i18n/*` para poder añadirlo, pero no
  se implementa ahora).
- PWA/offline, polígonos de clima, alertas push.
- Cambios al motor de riesgo del backend (solo presentación).