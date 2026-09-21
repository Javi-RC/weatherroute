# WeatherRoute — Design Spec

- Fecha: 2026-09-21
- Estado: aprobado

## 1. Problema

El usuario define origen, destino, actividad, fecha y hora de salida. La
aplicación calcula varias rutas posibles y, además de distancia y duración,
incorpora las condiciones meteorológicas **a lo largo de cada ruta** para
responder a la pregunta: "¿qué ruta y horario ofrecen las condiciones más
adecuadas para esta actividad?".

No es una app de clima. Es un *weather-aware route planner* con evaluación de
riesgo por actividad, desglose explicable de la puntuación y recomendación.

## 2. Decisiones confirmadas

- **Backend**: C# / .NET 10 (LTS), arquitectura hexagonal.
- **Frontend**: Vite + React 19 + TypeScript + Tailwind 4 + React Query + React
  Hook Form + Zod + MapLibre GL JS + Recharts.
- **Routing/geocoding**: OpenRouteService (free tier, API key). Perfiles por
  actividad.
- **Weather**: Open-Meteo (sin key). Forecast horario.
- **Persistencia**: PostgreSQL con EF Core para análisis anónimos (sin auth).
- **Cache**: Redis (`IDistributedCache`).
- **Infra**: Docker Compose (api, frontend+nginx, postgres, redis). CI con
  GitHub Actions.
- **Ubicación**: `C:\Users\javir\OneDrive\Documentos\weatherroute\`, repo git
  propio + remoto GitHub.
- **Sin autenticación**: análisis anónimos; cero usuarios.

## 3. Arquitectura hexagonal

### 3.1 Domain (sin dependencias externas)

```text
Entities/
  Route.cs
  RouteSegment.cs
  WeatherSnapshot.cs
ValueObjects/
  Coordinates.cs
  Distance.cs
  Duration.cs
  Wind.cs
  Temperature.cs
Enums/
  ActivityType.cs      (Walking, Running, Cycling, Motorcycle, Driving)
  RiskLevel.cs         (Low, Moderate, High, Severe)
  WeatherCondition.cs  (Clear, Clouds, Rain, Storm, Snow, Fog, ...)
Services/
  RouteRiskCalculator.cs   (Strategy por actividad)
Exceptions/
```

- `Route` es un agregado compuesto por `RouteSegment`s ordenados con su
  geometría (puntos muestreados), distancia, duración estimada y, tras el
  análisis, `WeatherSnapshot` por segmento (`AssignWeather`).
- ValueObjects inmutables con `record`, validación en el constructor (lat lon
  en rango, distancias/duras positivas).

### 3.2 Application (casos de uso + puertos)

```text
UseCases/
  CalculateRouteUseCase.cs
Ports/
  In/ICalculateRouteUseCase.cs
  Out/IGeocodingProvider.cs
  Out/IRouteProvider.cs
  Out/IWeatherProvider.cs
  Out/IAnalysisRepository.cs
Services/
  IRiskAssessmentService.cs
```

`CalculateRouteUseCase` orquesta: normalizar entradas → geocodificar origen y
destino → pedir N rutas candidatas → muestrear geometría → asignar hora de
llegada por punto → consultar tiempo por punto+hora → construir segmentos →
evaluar riesgo por actividad → generar recomendación → cachear → persistir
análisis anónimo. La aplicación no conoce proveedores concretos ni HTTP.

### 3.3 Output ports

```csharp
IGeocodingProvider  Task<Coordinates> GeocodeAsync(string place, ...);
IRouteProvider      Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(Coordinates origin, Coordinates destination, ActivityType activity, ...);
IWeatherProvider    Task<WeatherForecast> GetForecastAsync(Coordinates coordinates, DateTime timestamp, ...);
IAnalysisRepository Task<Guid> SaveAsync(RouteAnalysis analysis, ...);
```

`ExternalRoute` expone geometría (lista de coordenadas), distancia y duración;
es un DTO de adaptador, no entidad de dominio.

### 3.4 Infrastructure

```text
Weather/OpenMeteoWeatherAdapter.cs
Routing/OpenRouteServiceRoutingAdapter.cs     (routing + geocoding)
Persistence/AppDbContext.cs
Persistence/AnalysisRepository.cs
Caching/RouteAnalysisCacheDecorator.cs        (Redis IDistributedCache)
Resilience/   (Microsoft.Extensions.Resilience: retry, timeout, circuit breaker)
Health/       (health checks /health y /health/ready)
Telemetry/    (OpenTelemetry metrics/logs)
```

#### Sampling de la ruta

Sobre la geometría GeoJSON de ORS:
1. Acumular distancia punto a punto (haversine).
2. Muestrear cada ~10 km (hasta 20 puntos máx. — límite de llamadas a
   Open-Meteo y de payload).
3. Estimar hora de llegada a cada punto: `departure + distanciaAcumulada /
   velocidadPerfil(actividad)` con velocidad base por perfil (walking ~5,
   running ~10, cycling ~20, motorcycle ~60, driving ~60 km/h).
4. Consultar Open-Meteo por punto y hora redondeada a la hora más próxima.
5. Asignar `WeatherSnapshot` a cada segmento (mezcla de puntos del segmento).

Si el forecast no cubre la fecha (fuera de rango de ~7 días), la API responde
`status: partial` con `weatherAvailable: false` y la ruta sin datos de tiempo.

#### Caché

- Key: `route-analysis:{hash(origin,dest,activity,departureUtc)}`.
- TTL: hasta el inicio del forecast (mín. 60s) — el forecast horario se
  actualiza, se evita servir datos obsoletos.
- Store: Redis vía `IDistributedCache` (registrado con add StackExchangeRedis),
  con fallback a memoria si Redis no está disponible (para arranque sin Docker).

#### Resiliencia

- Clientes `HttpClient` tipados con `Microsoft.Extensions.Http.Resilience`.
- Retry exponencial (weather/routing), timeout, circuit breaker.
- Si un proveedor falla tras reintentos: respuesta `200` con
  `status: partial` indicando `weatherAvailable`/`routeAvailable`, nunca un
  `500` silencioso sin contexto.

### 3.5 Api

- `POST /api/routes/analyze` — `CalculateRouteRequest` → `RouteAnalysisResult[]`
  (hasta 3 rutas) con `risk`, `score`, `factors[]` (motivos), `segments[]`
  (weather por tramo), `recommendation`.
- `POST /api/routes/analyses` — persiste análisis anónimo → 201 con id.
- `GET /api/geocode?q=...` — útil para el autocomplete del frontend.
- `GET /health`, `GET /health/ready`.
- Validación con FluentValidation; errores en `ProblemDetails`.
- CORS restringido al origen del frontend (`FRONTEND_ORIGIN`).

### 3.6 Risk engine (explicable)

Cada actividad define una estrategia (Strategy) con factores y pesos:

| Actividad | Factores |
|-----------|----------|
| Cycling   | viento, temperatura, lluvia, prob. precipitación, visibilidad, UV, tormenta |
| Running   | temperatura, humedad, índice de calor, lluvia, viento, UV |
| Walking   | temperatura, lluvia, prob. precipitación, UV, viento |
| Driving   | lluvia, visibilidad, viento, nieve, hielo, tormenta |
| Motorcycle| lluvia, viento, visibilidad, temperatura, tormenta |

Cada factor aporta una penalización (0–N puntos). `score = 100 - penalización`,
entre 0 y 100. Mapeo `score → RiskLevel`:

- 0–25: Severe, 26–50: High, 51–75: Moderate, 76–100: Low.

**El score no es caja negra**: el resultado incluye `factors[]` con
`type`, `level`, `contribution` y `message` (p. ej. "Strong wind: 32 km/h").

Umbrales de ejemplo (cycling): viento <15 km/h ok (+0), 15–25 (+12), 25–40
(+25), >40 (+45). Temperatura fuera de [5, 35] penaliza según desviación.
Prob. lluvia >60% (+20). UV >6 (+10). weather_code de tormenta (+40).

### 3.7 Frontera de datos (contratos REST)

```json
// POST /api/routes/analyze
{
  "origin": "Ciudad Real",
  "destination": "Almagro",
  "activity": "Cycling",
  "departureTime": "2026-09-27T08:00:00Z",
  "maxDurationMinutes": null
}
```

```json
// 200 OK
{
  "status": "full",
  "weatherAvailable": true,
  "routeAvailable": true,
  "recommendation": "…",
  "routes": [
    {
      "id": "route-1",
      "distanceKm": 74.2,
      "durationMinutes": 168,
      "risk": { "level": "Low", "score": 88, "factors": [ … ] },
      "segments": [
        {
          "fromIndex": 0, "toIndex": 3,
          "distanceKm": 12.4, "arrivalTime": "2026-09-27T08:24:00Z",
          "weather": { "temperature": 18, "windKmh": 8, "precipitationProb": 10,
                       "uv": 3, "visibility": 10, "condition": "Clear" }
        }
      ],
      "polyline": [[38.98, -3.92], … ]
    }
  ]
}
```

### 3.8 Frontend

Estructura `src/features/{route-planner, weather-analysis, risk-analysis, map}`.

- **Formulario** (React Hook Form + Zod): origen, destino, actividad, fecha,
  hora, duración máx. (opcional).
- **Resultado**: mapa MapLibre (rutas candidatas pintadas, color por riesgo),
  tabla comparativa de rutas, timeline meteorológico por tramo, desglose de
  factores ("Por qué 68/100"), recomendación de salida.
- **Estados**: loading (skeleton), error (mensaje + reintento) y empty.
- **Comparación**: A/B/C de rutas (distancia, duración, lluvia, viento, riesgo).

## 4. Testing

- **Domain**: `RouteRiskCalculatorTests` — casos tabla (viento 40 km/h +
  cycling → factor HIGH; scoring determinista).
- **Application**: `CalculateRouteUseCaseTests` con fakes de los puertos;
  verifica enriquecimiento con weather y caché.
- **Infrastructure**: adaptadores con `HttpClient` mocked; un *contrato* por
  adaptador etiquetado `[Trait("Category", "Integration")]` contra APIs reales.
- **API**: `WebApplicationFactory` + Testcontainers (Postgres/Redis).
- **Frontend**: Vitest + React Testing Library.

## 5. DevOps

- `tests/` bandeja xUnit; `dotnet test` en CI.
- Docker Compose: `api`, `frontend` (nginx estático), `postgres`, `redis`.
- GitHub Actions `ci.yml`: build .NET, tests, build frontend, vitest run, lint,
  build imágenes. Deploy documentado (Fly/Railway) como opcional.

## 6. Fases

1. **Fase 0** — SDK, scaffolding, sln, CI básico.
2. **Fase 1** — MVP end-to-end (geocode → routing → sampling → weather → API →
   frontend muestra ruta+tiempo).
3. **Fase 2** — Domain risk engine con Strategy + desglose explicable.
4. **Fase 3** — Postgres + EF Core, Redis cache, resiliencia, health,
   observabilidad.
5. **Fase 4** — UX: comparación, timeline, mapa interactivo, estados.
6. **Fase 5** — Docker compose, nginx, CI/CD, README, AGENTS.md.

## 7. Fuera de alcance (yagni)

- Autenticación, usuarios, guardar rutas por cuenta (localStorage no requerido).
- Multi-idioma, PWA, offroad/via a pie fuera de calles.
- Integración con Google/Apple Maps.