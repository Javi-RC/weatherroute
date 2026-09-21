# ADR 0001 — Provider choice for routing/geocoding and weather

- Status: accepted
- Date: 2026-09-21
- Spec: `docs/superpowers/specs/2026-09-21-weatherroute-design.md`

## Context

WeatherRoute needs two external data providers:

1. **Routing + geocoding** — free-form place names to coordinates, and
   multi-profile directions (walking, running, cycling, motorcycle, car) for a
   per-activity route planner.
2. **Weather** — free, key-less, **hourly** forecast fields along the route
   points: temperature, wind, precipitation probability, UV, visibility and
   weather code (rain/snow/storm).

Product constraints: no user accounts, low cost (personal/hobby scale), and the
weather-aware risk engine needs historical-free *forecast* data only (no current
conditions, no paid archives).

## Decision

- **Routing + geocoding: OpenRouteService (ORS)** — geocoding
  `GET /v2/geocode/search` and routing `POST /v2/directions/{profile}`, with a
  free-tier API key sent via `Authorization` header.
- **Weather: Open-Meteo** — no API key, hourly variables via a single
  `https://api.open-meteo.com` endpoint.

Both are consumed exclusively through the application's output ports
(`IGeocodingProvider`, `IRouteProvider`, `IWeatherProvider`), so swapping a
provider only means a new adapter in `WeatherRoute.Infrastructure`.

## Options considered

**Routing/geocoding:**
- *Google Maps / Mapbox / Here* — comprehensive but require API keys, billing
  accounts, and have restrictive free tiers (usage quotas and/or attribution
  rules). Heavier than the product needs.
- *OSRM / Valhalla (self-hosted)* — excellent routing, but no geocoding API and
  no hosted free tier without operating infrastructure.
- *OpenRouteService* — accepted. Open (OSM-based) data, a **free tier that
  covers hobby usage**, **multiple transport profiles** mapped directly to our
  five activities (cycling/walking/running/motorcycle/car), and **geocoding
  bundled** so one provider (and one HTTP client) serves both needs.

**Weather:**
- *OpenWeatherMap / WeatherAPI / Visual Crossing* — free tiers exist but come
  with API keys, request-rate limits and paywalls on higher-resolution or
  forecast granularity.
- *Open-Meteo* — accepted. **Free with no API key**, no rate-limit for
  non-commercial use, and directly exposes the **hourly fields** the risk engine
  needs (`temperature_2m`, `wind_speed_10m`, `precipitation_probability`,
  `uv_index`, `visibility`, `weather_code`) with a `~7`-day forecast window,
  `timezone=UTC`.

## Consequences

- ORS requires an API key to be configured (`OpenRouteServiceOptions:ApiKey`);
  without it or with a failure, the API degrades to `status: partial` rather
  than failing (resilience + contract tests in `WeatherRoute.Infrastructure`).
- Profile mapping (activity → ORS profile) is centralized in `OrsProfiles.cs`.
- Open-Meteo needs no secrets; its contract test hits the public API and the
  provider can only report `weatherAvailable: false` if the forecast is out of
  range or fails.
- Both providers are isolated behind ports — switching later (e.g. to a paid
  tier with attribution) touches only Infrastructure and appsettings, not
  Domain/Application logic.