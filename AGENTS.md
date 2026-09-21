# AGENTS.md

Guidance for AI agents working on this repository.

## Project

WeatherRoute — weather-aware route planner. Hexagonal .NET 10 backend
(`backend/`) + React 19 / Vite / Tailwind frontend (`frontend/`), PostgreSQL +
Redis. Product concept and details: `docs/superpowers/specs/2026-09-21-weatherroute-design.md`.

## Repo layout

- `backend/WeatherRoute.slnx` — solution file (note: `.slnx`, NOT `.sln`).
- `backend/WeatherRoute.Domain/` — entities, value objects, enums, pure risk
  engine (Strategy per activity). No external dependencies.
- `backend/WeatherRoute.Application/` — `CalculateRouteUseCase` + ports
  (`Ports/In`, `Ports/Out`) and DTOs. References Domain only.
- `backend/WeatherRoute.Infrastructure/` — adapters: OpenRouteService
  (geocoding + routing), Open-Meteo, EF Core/PostgreSQL persistence, Redis
  caching decorator, resilience, health checks.
- `backend/WeatherRoute.Api/` — Minimal-API endpoints, FluentValidation, DI
  composition, OpenTelemetry. References everything.
- `frontend/` — Vite + React 19 + Tailwind 4 app (React Query, react-hook-form,
  Zod, MapLibre, Recharts).
- `tests/` — xUnit solutions: `WeatherRoute.Domain.Tests`,
  `WeatherRoute.Application.Tests`, `WeatherRoute.Infrastructure.Tests`,
  `WeatherRoute.Api.IntegrationTests`.
- `docs/superpowers/specs/` and `docs/superpowers/plans/` — authoritative design
  spec and implementation plan. Check these before changing behavior.

## Gate commands (verified — CI parity)

```bash
# Restore once, then:
dotnet build backend/WeatherRoute.slnx --no-restore -warnaserror   # must be 0 warnings/errors
dotnet test backend/WeatherRoute.slnx --filter "Category!=Integration"   # fast suite, no Docker
dotnet test backend/WeatherRoute.slnx --filter "Category=Integration"    # needs Docker up; ORS contract test skips without OPENROUTESERVICE_API_KEY

# Frontend (from frontend/):
npm run typecheck && npm test && npm run build
```

Note: `dotnet test` from the repo root also needs `--no-build`/the same restore
step in CI; build gate always uses `--no-restore -warnaserror`.

## Hexagon layering rule

Dependencies flow inward only:

- `Domain` → nothing external.
- `Application` → Domain only. Must NOT reference Infrastructure or Api.
- `Infrastructure` → Application + Domain (implements ports).
- `Api` → all layers (composition root).

Application code talks to providers **only through output ports**
(`Ports/Out/IGeocodingProvider`, `IRouteProvider`, `IWeatherProvider`,
`IAnalysisRepository`). Never let infrastructure leak into Domain/Application.

## Config & environment keys

- `OpenRouteServiceOptions:ApiKey` — OpenRouteService free-tier key.
- `ConnectionStrings:DefaultConnection` — PostgreSQL.
- `ConnectionStrings:Redis` — Redis (empty → in-memory `IDistributedCache`).
- `CachingOptions:Provider` — `Redis` to wrap the use case in the caching
  decorator; anything else uses in-memory.
- `Persistence:AutoMigrate` — default true, migrates in try/catch (non-fatal).
- Env var for compose: `OPENROUTESERVICE_API_KEY` (see `.env.example`).

## Secrets

**Never commit secrets.** No real API keys, passwords or connection strings in
committed files. Only placeholders in `.env.example`; real `.env` is gitignored.
Provider URLs/keys always come via `IConfiguration`, never hardcoded.

## Provider profile mapping (OpenRouteService)

`ActivityType` → ORS profile (`backend/WeatherRoute.Infrastructure/Routing/OrsProfiles.cs`):

- Walking / Running → `foot-walking`
- Cycling → `cycling-regular`
- Motorcycle → `driving-motorcycle`
- Driving → `driving-car`

Geocoding: `GET /v2/geocode/search?text=`; routing: `POST /v2/directions/{profile}`
with `Authorization` header. Open-Meteo: free, no key, `timezone=UTC`, hourly
weather (temperature, wind, precipitation probability, UV, visibility, code).

## Conventions

- Commit style: `feat:`, `fix:`, `test:`, `docs:`, `chore:` prefixes. Commit
  after each green step as one focused change.
- C#: nullable enabled, implicit usings, `TreatWarningsAsErrors`.
- Namespaces: `WeatherRoute.Domain|Application|Infrastructure|Api`. Tests under
  `WeatherRoute.*.Tests`.
- Integration-tagged tests use `[Trait("Category", "Integration")]`.
- Don't touch `.superpowers/` files — they are the internal workflow folder.