# WeatherRoute — Architecture

Companion doc to the design spec
(`docs/superpowers/specs/2026-09-21-weatherroute-design.md`) and the
implementation plan (`docs/superpowers/plans/2026-09-21-weatherroute.md`).
Cite those for full details.

## Hexagonal layering

Dependencies point inward; adapters live at the edge, ports are defined by the
application.

```
                        +-------------- WeatherRoute.Api --------------+
                        | POST /api/routes/analyze                REST |
                        | POST /api/routes/analyses  GET /health...    |
                        +------------------------+---------------------+
                                                 | inbound port (use case)
                    +----------------------------v----------------------+
                    |              WeatherRoute.Application             |
                    |  CalculateRouteUseCase                            |
                    |          |                 |                      |
                    |  outbound ports (interfaces, no HTTP, no EF)     |
                    |  IGeocodingProvider  IRouteProvider               |
                    |  IWeatherProvider    IAnalysisRepository          |
                    +-----------|-------------------|-------------------+
                                |                   |
            +-------------------+               +--------------------------+
            | WeatherRoute.Domain | <----------- | WeatherRoute.Infrastructure |
            | pure risk engine,  |   (adapters) | ORS, Open-Meteo, EF Core,  |
            | entities, VOs      |              | Redis, resilience, health  |
            +--------------------+              +---------------------+------+
                                                                      |
                                                    +----------------+----------------+
                                                    |                |                |
                                                    v                v                v
                                              OpenRouteService  Open-Meteo   PostgreSQL / Redis
                                             (geocode + route)  (forecast)    (persist / cache)
```

- **Domain** — pure: entities (`Route`, `RouteSegment`, `WeatherSnapshot`),
  value objects, and the per-activity risk engine (Strategy + `RiskScoring`).
  Nothing to reference.
- **Application** — orchestrates a single analysis: geocode origin+destination →
  request candidate routes → sample geometry (~10 km/point, ≤ 20 points) →
  assign arrival time per point from activity pace → fetch hourly weather per
  point → build segments → assess risk per activity → recommend → cache → persist.
  Only known external names are the output ports.
- **Infrastructure** — concrete adapters behind those ports (OpenRouteService
  does both geocoding and routing; Open-Meteo weather; EF Core + PostgreSQL;
  `IDistributedCache` Redis caching decorator with in-memory fallback; resilience
  policies; health checks; OpenTelemetry).
- **Api** — composition root: binds config, registers DI, wires FluentValidation,
  CORS, JSON enum serialization and the minimal-API endpoints.

## Data flow (one analysis)

1. `POST /api/routes/analyze` arrives with origin, destination, activity,
   departure time (UTC), optional max duration.
2. `CalculateRouteUseCase` geocodes both endpoints (`IGeocodingProvider`),
   requests up to 2 candidate routes (`IRouteProvider`), then samples each
   geometry into segments with estimated arrival times.
3. For each segment it fetches weather for the midpoint at arrival time
   (`IWeatherProvider`, Open-Meteo). A provider failure sets `weatherAvailable:
   false` — the response stays `200` with `status: "partial"`, never a bare 500.
4. The domain risk engine scores each route (0–100) with explicit factors; the
   use case drops routes over `maxDurationMinutes`, builds the recommendation,
   caches the whole result (Redis decorator) and the response is returned.

Because `CachingOptions:Provider` can be `Redis` or anything else, the caching
decorator is opt-in at composition time and degrades to in-memory storage when
no Redis connection string is configured.