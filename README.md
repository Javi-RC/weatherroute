# WeatherRoute

Given an origin, destination, activity and departure time it returns up to 2
candidate routes with distance, duration and a per-activity **risk score** driven
by forecast weather along the route — *"which route has the best conditions?"*.
No accounts; anonymous analysis.

## Architecture

Hexagonal .NET 10 backend + React 19 frontend (domain pure, ports at the edge).

```
+------------ WeatherRoute.Api (REST) ------------+
| POST /api/routes/analyze | POST /api/routes/analyses | GET /health[/ready] |
+-----------------+-------------------------------+
                  | use case (inbound port)
+-----------------v-------------------------------+
| WeatherRoute.Application: CalculateRouteUseCase |
| geocode -> routes -> sample -> weather -> risk  |
| -> recommend -> cache -> persist                |
+--+-------+--------+--------+-------+
   |       |        |        |
   v       v        v        v
+------+ +------+ +------+ +------------+   +----------------------------+
| ORS  | | ORS  | |Open- | | PostgreSQL |   | WeatherRoute.Domain: deep  |
| geo- | | rout-| |Meteo | | (EF Core,  |   | .NET risk engine, VOs      |
|code  | | ing  | | (fr. | | Redis cache|   +----------------------------+
|      | |      | |cast) | | via IDistr |   ^
+------+ +------+ +------+ +------------+   | (pure, no external deps)
                                 Infrastructure adapters fill the ports
```

Tech: C# / .NET 10 · ASP.NET Core Minimal APIs · EF Core + Npgsql ·
FluentValidation · xUnit · Microsoft.Extensions.Http.Resilience · OpenTelemetry ·
React 19 + TypeScript + Vite + Tailwind 4 + React Query + react-hook-form + Zod +
MapLibre GL + Recharts + Vitest · PostgreSQL 17 · Redis 7 · Docker Compose · GH Actions.

## Quick start (Docker Compose)

```bash
cp .env.example .env        # put a real OPENROUTESERVICE_API_KEY in .env
docker compose up --build
```

UI http://localhost:3000 · API http://localhost:5080 · Postgres/Redis private.
`.env` is gitignored; only `.env.example` placeholders are committed.

## Local development

```bash
dotnet run --project backend/WeatherRoute.Api   # API (backend/)
cd frontend && npm install && npm run dev       # Vite :5173, proxies /api -> :5080
```

Keys: `OpenRouteServiceOptions:ApiKey`, `ConnectionStrings:DefaultConnection`,
`ConnectionStrings:Redis` (empty → in-memory cache), `CachingOptions:Provider`
(`Redis` = caching decorator), `Persistence:AutoMigrate` (default true, non-fatal).

## Tests

```bash
dotnet build backend/WeatherRoute.slnx --no-restore -warnaserror
dotnet test  backend/WeatherRoute.slnx --filter "Category!=Integration"   # fast suite, no Docker
dotnet test  backend/WeatherRoute.slnx --filter "Category=Integration"    # needs Docker (and ORS key)
cd frontend && npm run typecheck && npm test && npm run build
```

## API reference

| Method | Path | Description |
|---|---|---|
| POST | `/api/routes/analyze` | Analyze routes for an activity + departure time |
| POST | `/api/routes/analyses` | Persist an anonymous analysis → `201 {"id":…}` |
| GET | `/api/geocode?q=…` | Geocode → `{query, coordinates:{lat,lon}}` |
| GET | `/health`, `/health/ready` | Liveness / readiness (DB check) |

`POST /api/routes/analyze` sample request:

```json
{
  "origin": "Ciudad Real",
  "destination": "Almagro",
  "activity": "Cycling",
  "departureTime": "2026-09-27T08:00:00Z",
  "maxDurationMinutes": null
}
```

`activity` ∈ `Walking | Running | Cycling | Motorcycle | Driving`. Response has
`status: "full"|"partial"` (+ `weatherAvailable`/`routeAvailable` = false on
provider failure, never a bare 500), `recommendation`, and `routes[]` each with
`riskLevel`, `riskScore` (0–100), `factors[]` (explicable contributions),
`segments[]` (weather per stretch) and `polyline`.

## Roadmap

Fases 0–5 implemented: MVP end-to-end, domain risk engine, PostgreSQL + Redis,
resilience/health/telemetry, UX (comparison, weather timeline, map, loading/
error/empty states) and Docker Compose. Remaining: final verification pass.

Details: `docs/architecture.md` · `docs/adr/0001-provider-choice.md`