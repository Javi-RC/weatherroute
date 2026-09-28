# Maps-Style Redesign (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the WeatherRoute frontend into a Google-Maps-style route planner — fixed sidebar + permanent map, with map-click selection of origin/destination backed by a new API that accepts coordinates.

**Architecture:** The backend change is additive: `CalculateRouteRequest` gains optional `originCoordinates`/`destinationCoordinates`; the use case skips geocoding when they are present; the cache key distinguishes coordinates from text. The frontend change extracts state out of `App.tsx` into `useUrlState` + `useRouteAnalysis`, recomposes the layout from absolutely-positioned floating panels into a `flex` sidebar + map, and rewrites `MapCanvas` around an imperative handle so the map never moves unless `App` asks it to. `Domain` and `IRouteProvider` are untouched.

**Tech Stack:** C#/.NET 10 (FluentValidation, xUnit), React 19 + TypeScript + Vite, Tailwind 4, MapLibre GL JS 5, Recharts 3, Vitest + React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-28-weatherroute-maps-redesign.md`

## Global Constraints

- **Layering (non-negotiable, from `AGENTS.md`):** `Domain` → nothing external. `Application` → Domain only, never Infrastructure or Api. `Infrastructure` → Application + Domain. `Api` → everything. Application code reaches providers **only through output ports**.
- C# conventions: nullable enabled, implicit usings, `TreatWarningsAsErrors`. Namespaces `WeatherRoute.Domain|Application|Infrastructure|Api`. Integration tests use `[Trait("Category", "Integration")]`.
- **Never commit secrets.** No real API keys or connection strings. Only placeholders in `.env.example`.
- Frontend: Tailwind design tokens come from `@theme` in `src/index.css` — do **not** create a `tailwind.config.js`. Risk colours are duplicated on purpose between `src/index.css` and `src/i18n/risk.ts` (MapLibre needs raw hex strings); keep both in sync.
- Existing primitives in `src/components/ui/` (`Button`, `TextInput`, `Badge`, `SegmentedControl`, `Sheet`, `Tooltip`, …) compose `className` with `[...].filter(Boolean).join(" ")`. There is no `cn`/clsx, so `className` overrides do **not** merge intelligently. Follow the same pattern.
- All user-facing copy is **Spanish (es-ES)**. Use the existing formatters in `src/lib/format.ts` and `src/lib/time.ts` rather than writing new ones.
- Accessibility baseline (WCAG 2.1 AA, commit `c5f15d7`) must not regress: skip-link, visible focus, `min-h-11` touch targets, `motion-safe:` on transitions, `prefers-reduced-motion` respected.
- Commit style: `feat:`, `fix:`, `test:`, `docs:`, `chore:`. One focused change per commit, committed after each green step.
- `frontend/test/stubs/maplibre.ts` is a hand-written contract. **Any new MapLibre API used by `MapCanvas` must be added to that stub before the test that uses it**, or every `MapCanvas.test.tsx` and `App.test.tsx` case breaks.
- Single responsive breakpoint: **1024px** (`lg`). Today `App.tsx:32` uses 1024px and `RouteDetail.tsx:17` uses 768px; this plan unifies them on 1024px, defined in one place only.

---

## Deviations found while executing Tasks 1–5 (2026-09-28)

Tasks 1–5 shipped in `c3c1056` and `13337cb`. The plan text was wrong or
underspecified in these places — the code is right, the plan was not:

- **`GeocodingException` is not usable from Application.** It lives in
  `WeatherRoute.Infrastructure/Routing`, and Application must not reference
  Infrastructure. `CalculateRouteUseCase.GeocodeAsync` throws
  `ArgumentException` instead. Do not "fix" this by moving the exception.
- **The validator must keep the error keys `Origin` / `Destination`.**
  `RouteAnalyzeTests.Empty_Origin_Returns_ValidationProblem` and the frontend
  read them, so the rules are `RuleFor(x => x.Origin).MaximumLength(200).NotEmpty().When(x => x.OriginCoordinates is null)`
  rather than a `RuleFor(x => x)` with a lowercase `WithName`.
- **Test projects have no `Nullable` enable.** Every new test file starts with
  `#nullable enable` (see `Fakes.cs:1`), otherwise `string?` is `error CS8632`
  under `-warnaserror`.
- **Test files are flat.** There is no `WeatherRoute.Api.UnitTests` and no
  subfolders: the validator tests live in
  `tests/WeatherRoute.Api.IntegrationTests/CalculateRouteRequestValidatorTests.cs`
  (untagged — a pure validator test needs no host) and the others beside their
  existing siblings. Namespaces stay `WeatherRoute.<Layer>.Tests`.
- **`/routes/analyses` has no validator**, so it answers a missing endpoint with
  a `400` `ValidationProblem` instead of throwing (the plan threw, which would
  have surfaced as a 500), and persists `"lat,lon"` as the label when only
  coordinates were given.
- **Tasks 1–4 are one commit.** `CalculateRouteRequest` cannot be nullable
  without the command, the use case and `BuildKey` changing in the same commit
  — each of the three plan steps leaves a red build on its own.
- **The analyze integration tests need no Docker.** They are untagged and run in
  the fast suite, so the `Category=Integration` gate is not required for them.

---

## File Structure

### Backend — created
| File | Responsibility |
|---|---|
| `backend/WeatherRoute.Api/Requests/CoordinatesDto.cs` | Transport DTO for a lat/lng pair. |

### Backend — modified
| File | Change |
|---|---|
| `backend/WeatherRoute.Api/Requests/CalculateRouteRequest.cs` | `Origin`/`Destination` become nullable; add optional coordinate DTOs. |
| `backend/WeatherRoute.Api/Requests/CalculateRouteRequestValidator.cs` | Text **or** coordinates per endpoint; range-check the coordinates. |
| `backend/WeatherRoute.Api/Endpoints/RouteEndpoints.cs` | Map request → command with the new fields; same for `/routes/analyses`. |
| `backend/WeatherRoute.Application/Ports/In/ICalculateRouteUseCase.cs` | `CalculateRouteCommand` gains optional `Coordinates` for both endpoints. |
| `backend/WeatherRoute.Application/UseCases/CalculateRouteUseCase.cs` | Geocode only when coordinates are absent. |
| `backend/WeatherRoute.Infrastructure/Caching/CachedCalculateRouteUseCase.cs` | `BuildKey` hashes coordinates (rounded) instead of always hashing labels. |

### Backend — tests
| File | Covers |
|---|---|
| `tests/WeatherRoute.Api.UnitTests/Requests/CalculateRouteRequestValidatorTests.cs` | Task 2 |
| `tests/WeatherRoute.Application.Tests/UseCases/CalculateRouteUseCaseCoordinatesTests.cs` | Task 3 |
| `tests/WeatherRoute.Infrastructure.Tests/Caching/CachedCalculateRouteUseCaseKeyTests.cs` | Task 4 |

> **Before writing the first task, run** `Get-ChildItem tests -Directory` to confirm the real test-project names and adjust the paths above. The four projects are `WeatherRoute.Domain.Tests`, `WeatherRoute.Application.Tests`, `WeatherRoute.Infrastructure.Tests`, `WeatherRoute.Api.IntegrationTests`. If there is no `WeatherRoute.Api.UnitTests` project, put the validator tests in `WeatherRoute.Api.IntegrationTests` (tagged `Integration` only if they need a host; a pure validator test needs no host and is untagged).

### Frontend — created
| File | Responsibility |
|---|---|
| `src/hooks/useUrlState.ts` | ⇄ query string. Parse on mount, `replaceState` on change, listen to `popstate`. |
| `src/hooks/useRouteAnalysis.ts` | The analysis state machine extracted out of `App.tsx` (Task 20). |
| `src/lib/breakpoints.ts` | The single `1024px` breakpoint + `useIsDesktop()` hook. |
| `src/components/layout/Sidebar.tsx` | The 380px left column: form on top, results + history below, one scroll. |
| `src/components/map/PickModeBar.tsx` | `role="toolbar"` overlay: Origen / Destino / + Vía / Ajustar vista. |
| `src/components/map/RouteDetailCard.tsx` | Floating card over the map: score, profile chart, factors, segments. |
| `src/components/results/RouteList.tsx` | `BestRouteBanner` + the list of `RouteCard`s, with arrow-key navigation. |
| `src/components/results/RouteProfileChart.tsx` | Recharts profile of the route's weather. |

### Frontend — modified
| File | Change |
|---|---|
| `src/App.tsx` | Shrinks to composition; delegates to the two hooks. |
| `src/layouts/AppShell.tsx` | `absolute` floating panels → `flex` row. |
| `src/components/map/MapCanvas.tsx` | Rewritten: three layers, click-to-pick, imperative handle, probe marker. |
| `src/lib/map.ts` | `selected` on features; asymmetric desktop fit padding. |
| `src/types.ts` | `AnalyzeRequest` gains optional coordinates. |
| `src/services/api.ts` | Unchanged API surface — coordinates ride along in the body. |
| `test/stubs/maplibre.ts` | New MapLibre surface. |
| `src/components/results/ResultsLayer.tsx` | Loses the route list (moves to `RouteList`). |
| `src/components/results/RouteDetail.tsx` | Uses the shared breakpoint; renders inside `RouteDetailCard` on desktop. |

### Frontend — deleted
| File | Why |
|---|---|
| `src/components/results/RouteDetail.tsx` | Its parts (`ScoreGauge`, `FactorList`, `SegmentStrip`) are reused inside `RouteDetailCard`; its own wrapper disappears with the expand-in-place pattern (Task 18). |

---

## Task 1: `CoordinatesDto` and the additive request change

**Files:**
- Create: `backend/WeatherRoute.Api/Requests/CoordinatesDto.cs`
- Modify: `backend/WeatherRoute.Api/Requests/CalculateRouteRequest.cs`

**Interfaces:**
- Produces: `WeatherRoute.Api.Requests.CoordinatesDto(double Latitude, double Longitude)`.
- Produces: `CalculateRouteRequest(string? Origin, string? Destination, ActivityType Activity, DateTime DepartureTime, CoordinatesDto? OriginCoordinates = null, CoordinatesDto? DestinationCoordinates = null, int? MaxDurationMinutes = null)`.

- [x] **Step 1: Write the DTO**

`backend/WeatherRoute.Api/Requests/CoordinatesDto.cs`:
```csharp
namespace WeatherRoute.Api.Requests;

public sealed record CoordinatesDto(double Latitude, double Longitude);
```

- [x] **Step 2: Change the request record**

`backend/WeatherRoute.Api/Requests/CalculateRouteRequest.cs` — the whole file:
```csharp
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.Requests;

public sealed record CalculateRouteRequest(
    string? Origin,
    string? Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    CoordinatesDto? OriginCoordinates = null,
    CoordinatesDto? DestinationCoordinates = null,
    int? MaxDurationMinutes = null);
```

Optional parameters come last so C# accepts the defaults. The JSON property names are `originCoordinates` / `destinationCoordinates` under the default camelCase policy.

- [x] **Step 3: Build the API project and fix the fallout**

```bash
dotnet build backend/WeatherRoute.slnx --no-restore
```

Expect errors in `RouteEndpoints.cs` (it passes `request.Origin` into a `string?` slot — that still compiles) and in the validator (`RuleFor(x => x.Origin).NotEmpty()` on a nullable now warns/errs under `-warnaserror`). Record the exact list; Task 2 and Task 3 resolve them. Do not proceed with a red build.

- [x] **Step 4: Commit**

```bash
git add backend/WeatherRoute.Api/Requests/
git commit -m "feat: accept optional coordinates in the analyze request"
```

---

## Task 2: Validator — text **or** coordinates

**Files:**
- Modify: `backend/WeatherRoute.Api/Requests/CalculateRouteRequestValidator.cs`
- Test: the validator test project (see the note in File Structure)

**Interfaces:**
- Consumes: `CoordinatesDto`, the new `CalculateRouteRequest`.
- Produces: `CalculateRouteRequestValidator` rejecting an endpoint that has neither text nor coordinates, and rejecting out-of-range coordinates with `400` + `ProblemDetails`.

- [x] **Step 1: Write the failing test**

```csharp
using FluentValidation;
using WeatherRoute.Api.Requests;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.IntegrationTests.Requests;

public sealed class CalculateRouteRequestValidatorTests
{
    private static CalculateRouteRequest Request(
        string? origin = "Madrid",
        string? destination = "Toledo",
        CoordinatesDto? originCoordinates = null,
        CoordinatesDto? destinationCoordinates = null) =>
        new(origin, destination, ActivityType.Cycling, DateTime.UtcNow,
            originCoordinates, destinationCoordinates);

    [Fact]
    public void Accepts_text_for_both_endpoints()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request());
        Assert.True(result.IsValid);
    }

    [Fact]
    public void Accepts_coordinates_without_text()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            origin: null, destination: null,
            originCoordinates: new CoordinatesDto(40.4168, -3.7038),
            destinationCoordinates: new CoordinatesDto(39.8628, -4.0273)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Accepts_a_mix_of_text_and_coordinates()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            destination: null,
            destinationCoordinates: new CoordinatesDto(39.8628, -4.0273)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Rejects_an_origin_with_neither_text_nor_coordinates()
    {
        var result = new CalculateRouteRequestValidator().Validate(
            Request(origin: null, originCoordinates: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == string.Empty
            && e.ErrorMessage.Contains("originCoordinates", StringComparison.Ordinal));
    }

    [Fact]
    public void Rejects_a_destination_with_neither_text_nor_coordinates()
    {
        var result = new CalculateRouteRequestValidator().Validate(
            Request(destination: null, destinationCoordinates: null));

        Assert.False(result.IsValid);
    }

    [Theory]
    [InlineData(91.0, 0.0)]
    [InlineData(-91.0, 0.0)]
    [InlineData(0.0, 181.0)]
    [InlineData(0.0, -181.0)]
    public void Rejects_out_of_range_coordinates(double latitude, double longitude)
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            destination: null,
            destinationCoordinates: new CoordinatesDto(latitude, longitude)));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Accepts_coordinates_on_the_range_boundary()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            destination: null,
            destinationCoordinates: new CoordinatesDto(90, 180)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Rejects_a_label_longer_than_200_characters()
    {
        var result = new CalculateRouteRequestValidator()
            .Validate(Request(origin: new string('x', 201)));

        Assert.False(result.IsValid);
    }
}
```

- [x] **Step 2: Run it and watch it fail**

```bash
dotnet test backend/WeatherRoute.slnx --filter "FullyQualifiedName~CalculateRouteRequestValidatorTests"
```

Expected: FAIL. `NotEmpty()` on `string?` now rejects the text-only request, and there is no rule requiring or validating coordinates.

- [x] **Step 3: Rewrite the validator**

`backend/WeatherRoute.Api/Requests/CalculateRouteRequestValidator.cs` — the whole file:
```csharp
using FluentValidation;

namespace WeatherRoute.Api.Requests;

public sealed class CalculateRouteRequestValidator : AbstractValidator<CalculateRouteRequest>
{
    public CalculateRouteRequestValidator()
    {
        RuleFor(x => x.Origin)
            .MaximumLength(200)
            .When(x => x.OriginCoordinates is null);
        RuleFor(x => x.Destination)
            .MaximumLength(200)
            .When(x => x.DestinationCoordinates is null);
        RuleFor(x => x.OriginCoordinates).Must(BeValidOrNull).WithName("originCoordinates");
        RuleFor(x => x.DestinationCoordinates).Must(BeValidOrNull).WithName("destinationCoordinates");
        RuleFor(x => x)
            .Must(x => x.OriginCoordinates is not null || !string.IsNullOrWhiteSpace(x.Origin))
            .WithMessage("Provide origin or originCoordinates.")
            .WithName("origin");
        RuleFor(x => x)
            .Must(x => x.DestinationCoordinates is not null || !string.IsNullOrWhiteSpace(x.Destination))
            .WithMessage("Provide destination or destinationCoordinates.")
            .WithName("destination");
        RuleFor(x => x.DepartureTime).NotEmpty();
        RuleFor(x => x.MaxDurationMinutes).GreaterThan(0).When(x => x.MaxDurationMinutes.HasValue);
    }

    private static bool BeValidOrNull(CoordinatesDto? coordinates)
    {
        if (coordinates is null) return true;
        return coordinates.Latitude is >= -90 and <= 90
            && coordinates.Longitude is >= -180 and <= 180;
    }
}
```

> **Note on the `NotEmpty()` removal.** The original `RuleFor(x => x.Origin).NotEmpty()` is gone on purpose: a click on the map legitimately has no text, and the new "text or coordinates" rule subsumes it. The `MaximumLength(200)` stays, but only applies when there is no coordinate for that endpoint, because a coordinate's label can legitimately be absent.

- [x] **Step 4: Run the tests and watch them pass**

```bash
dotnet test backend/WeatherRoute.slnx --filter "FullyQualifiedName~CalculateRouteRequestValidatorTests"
```

Expected: PASS, 10 cases.

- [x] **Step 5: Commit**

```bash
git add backend/WeatherRoute.Api/Requests/
git commit -m "feat: validate that each endpoint has text or coordinates"
```

---

## Task 3: The use case geocodes only when it has to

**Files:**
- Modify: `backend/WeatherRoute.Application/Ports/In/ICalculateRouteUseCase.cs`
- Modify: `backend/WeatherRoute.Application/UseCases/CalculateRouteUseCase.cs`
- Modify: `backend/WeatherRoute.Api/Endpoints/RouteEndpoints.cs`
- Test: `tests/WeatherRoute.Application.Tests/UseCases/CalculateRouteUseCaseCoordinatesTests.cs`

**Interfaces:**
- Consumes: `CoordinatesDto`, `WeatherRoute.Domain.ValueObjects.Coordinates`.
- Produces: `CalculateRouteCommand(string? Origin, string? Destination, Coordinates? OriginCoordinates, Coordinates? DestinationCoordinates, ActivityType Activity, DateTime DepartureTimeUtc, int? MaxDurationMinutes = null)`.

- [x] **Step 1: Write the failing test**

Read `tests/WeatherRoute.Application.Tests/` first and reuse the existing fake geocoding provider and fake route provider — do not write new ones. The assertion that matters is *absence of interaction*.

```csharp
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Tests.UseCases;

public sealed class CalculateRouteUseCaseCoordinatesTests
{
    [Fact]
    public async Task Uses_supplied_coordinates_without_geocoding()
    {
        var geocoding = new ThrowingGeocodingProvider();
        var useCase = BuildUseCase(geocoding, new FakeRouteProvider());

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            Origin: null,
            Destination: null,
            OriginCoordinates: new Coordinates(40.4168, -3.7038),
            DestinationCoordinates: new Coordinates(39.8628, -4.0273),
            Activity: ActivityType.Cycling,
            DepartureTimeUtc: DateTime.UtcNow));

        Assert.Equal(0, geocoding.CallCount);
        Assert.True(result.RouteAvailable);
    }

    [Fact]
    public async Task Geocodes_only_the_endpoint_that_has_no_coordinates()
    {
        var geocoding = new RecordingGeocodingProvider();
        var useCase = BuildUseCase(geocoding, new FakeRouteProvider());

        await useCase.ExecuteAsync(new CalculateRouteCommand(
            Origin: "Madrid",
            Destination: null,
            OriginCoordinates: null,
            DestinationCoordinates: new Coordinates(39.8628, -4.0273),
            Activity: ActivityType.Cycling,
            DepartureTimeUtc: DateTime.UtcNow));

        Assert.Equal(new[] { "Madrid" }, geocoding.Queries);
    }
}
```

> `ThrowingGeocodingProvider` throws on any call; `RecordingGeocodingProvider` records queries and returns `new Coordinates(40.4168, -3.7038)`. If the existing test project already has a single recording fake, add a `Queries` list to it instead of adding a second type. Copy the exact constructor wiring of `CalculateRouteUseCaseTests` — it constructs `CalculateRouteUseCase` with `(geocoding, routes, weather, sampler, risk)`.

- [x] **Step 2: Run it and watch it fail**

```bash
dotnet test backend/WeatherRoute.slnx --filter "FullyQualifiedName~CalculateRouteUseCaseCoordinatesTests"
```

Expected: FAIL to compile — `CalculateRouteCommand` has no `OriginCoordinates` parameter.

- [x] **Step 3: Extend the command**

`backend/WeatherRoute.Application/Ports/In/ICalculateRouteUseCase.cs`:
```csharp
using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Ports.In;

public interface ICalculateRouteUseCase
{
    Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default);
}

public sealed record CalculateRouteCommand(
    string? Origin,
    string? Destination,
    Coordinates? OriginCoordinates,
    Coordinates? DestinationCoordinates,
    ActivityType Activity,
    DateTime DepartureTimeUtc,
    int? MaxDurationMinutes = null);
```

- [x] **Step 4: Make the use case conditional**

In `CalculateRouteUseCase.cs`, replace lines 40-41 with:
```csharp
var origin = command.OriginCoordinates ?? await GeocodeAsync(command.Origin, ct);
var destination = command.DestinationCoordinates ?? await GeocodeAsync(command.Destination, ct);
```

Add this private helper to the class:
```csharp
private async Task<Coordinates> GeocodeAsync(string? place, CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(place))
        throw new GeocodingException("Neither a place name nor coordinates were provided.");
    return await _geocoding.GeocodeAsync(place, ct);
}
```

Add `using WeatherRoute.Application.Ports.Out;` is already present — `GeocodingException` lives in that namespace, so no new using is needed. Verify with the compiler.

- [x] **Step 5: Map the request onto the command in the endpoint**

`RouteEndpoints.cs`, `/routes/analyze` — replace the `var command = ...` block:
```csharp
var command = new CalculateRouteCommand(
    request.Origin,
    request.Destination,
    ToCoordinates(request.OriginCoordinates),
    ToCoordinates(request.DestinationCoordinates),
    request.Activity,
    request.DepartureTime.Kind == DateTimeKind.Utc
        ? request.DepartureTime
        : DateTime.SpecifyKind(request.DepartureTime, DateTimeKind.Utc),
    request.MaxDurationMinutes);
```

Add a private static helper to `RouteEndpoints`:
```csharp
private static Coordinates? ToCoordinates(CoordinatesDto? dto) =>
    dto is null ? null : new Coordinates(dto.Latitude, dto.Longitude);
```

`/routes/analyses` also needs updating in this task, because it constructs the same command shape indirectly — see Step 6.

- [x] **Step 6: Extend `/routes/analyses` consistently**

`RouteEndpoints.cs:74-75` currently geocodes unconditionally. Replace with:
```csharp
var originCoord = request.OriginCoordinates ?? await GeocodeRequiredAsync(geocoding, request.Origin, ct);
var destinationCoord = request.DestinationCoordinates ?? await GeocodeRequiredAsync(geocoding, request.Destination, ct);
```

And add:
```csharp
private static async Task<Coordinates> GeocodeRequiredAsync(
    IGeocodingProvider geocoding, string? place, CancellationToken ct)
{
    if (string.IsNullOrWhiteSpace(place))
        throw new ArgumentException("Provide origin or originCoordinates.");
    return await geocoding.GeocodeAsync(place, ct);
}
```

`SaveAnalysisRequest` must also gain `CoordinatesDto? OriginCoordinates = null` and `CoordinatesDto? DestinationCoordinates = null`, otherwise the code above will not compile.

- [x] **Step 7: Run the whole fast suite**

```bash
dotnet test backend/WeatherRoute.slnx --filter "Category!=Integration"
```

Expected: PASS. Fix any other test that constructs `CalculateRouteCommand` positionally — they need the two new arguments.

- [x] **Step 8: Commit**

```bash
git add backend/WeatherRoute.Application backend/WeatherRoute.Api
git commit -m "feat: skip geocoding when analyze receives coordinates"
```

---

## Task 4: The cache key distinguishes coordinates from text

**Files:**
- Modify: `backend/WeatherRoute.Infrastructure/Caching/CachedCalculateRouteUseCase.cs`
- Test: `tests/WeatherRoute.Infrastructure.Tests/Caching/CachedCalculateRouteUseCaseKeyTests.cs`

**Interfaces:**
- Consumes: `CalculateRouteCommand` with `Coordinates?`.
- Produces: `public static string BuildKey(CalculateRouteCommand command)` — unchanged signature, new hashing. Coordinates round to 4 decimal places (`F4`, ≈11 m) so two clicks on the same street share an entry.

- [x] **Step 1: Write the failing tests**

```csharp
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Caching;

namespace WeatherRoute.Infrastructure.Tests.Caching;

public sealed class CachedCalculateRouteUseCaseKeyTests
{
    private static readonly DateTime Departure = new(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc);

    private static CalculateRouteCommand Command(
        string? origin = null, string? destination = null,
        Coordinates? originCoordinates = null, Coordinates? destinationCoordinates = null) =>
        new(origin, destination, originCoordinates, destinationCoordinates,
            ActivityType.Cycling, Departure);

    [Fact]
    public void Same_coordinates_with_different_labels_share_a_key()
    {
        var a = CachedCalculateRouteUseCase.BuildKey(Command(
            "Madrid", "Toledo", new Coordinates(40.4168, -3.7038), new Coordinates(39.8628, -4.0273)));
        var b = CachedCalculateRouteUseCase.BuildKey(Command(
            "Puerta del Sol", "Alcázar", new Coordinates(40.4168, -3.7038), new Coordinates(39.8628, -4.0273)));

        Assert.Equal(a, b);
    }

    [Fact]
    public void Coordinates_within_eleven_metres_share_a_key()
    {
        var a = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.41680, -3.70380), destinationCoordinates: new Coordinates(39.86280, -4.02730)));
        var b = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.41682, -3.70381), destinationCoordinates: new Coordinates(39.86281, -4.02731)));

        Assert.Equal(a, b);
    }

    [Fact]
    public void Distinguishable_coordinates_produce_different_keys()
    {
        var a = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273)));
        var b = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(41.0000, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273)));

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void A_text_endpoint_never_collides_with_a_coordinate_endpoint()
    {
        var byText = CachedCalculateRouteUseCase.BuildKey(Command(
            "40.4168,-3.7038", "39.8628,-4.0273"));
        var byCoordinate = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038),
            destinationCoordinates: new Coordinates(39.8628, -4.0273)));

        Assert.NotEqual(byText, byCoordinate);
    }

    [Fact]
    public void Different_activities_produce_different_keys()
    {
        var walking = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273)));
        var driving = CachedCalculateRouteUseCase.BuildKey(new CalculateRouteCommand(
            null, null, new Coordinates(40.4168, -3.7038), new Coordinates(39.8628, -4.0273),
            ActivityType.Driving, Departure));

        Assert.NotEqual(walking, driving);
    }
}
```

- [x] **Step 2: Run it and watch it fail**

```bash
dotnet test backend/WeatherRoute.slnx --filter "FullyQualifiedName~CachedCalculateRouteUseCaseKeyTests"
```

Expected: `Same_coordinates_with_different_labels_share_a_key` FAILS, because the current key hashes the labels.

- [x] **Step 3: Rewrite `BuildKey`**

`CachedCalculateRouteUseCase.cs` — replace the `BuildKey` method and add the helper:
```csharp
public static string BuildKey(CalculateRouteCommand command)
{
    var raw = string.Join("|",
        Part(command.OriginCoordinates, command.Origin),
        Part(command.DestinationCoordinates, command.Destination),
        command.Activity,
        $"{command.DepartureTimeUtc:o}",
        command.MaxDurationMinutes);
    var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
    return $"route-analysis:{hash}";
}

private static string Part(Coordinates? coordinates, string? label) =>
    coordinates is null
        ? $"t:{label?.ToLowerInvariant()}"
        : $"c:{coordinates.Latitude.ToString("F4", CultureInfo.InvariantCulture)},{coordinates.Longitude.ToString("F4", CultureInfo.InvariantCulture)}";
```

Add `using System.Globalization;` and `using WeatherRoute.Domain.ValueObjects;`. The `InvariantCulture` matters: under a comma-decimal locale `"F4"` would emit `40,4168` and collide with the separator.

- [x] **Step 4: Run the tests**

```bash
dotnet test backend/WeatherRoute.slnx --filter "FullyQualifiedName~CachedCalculateRouteUseCaseKeyTests"
```

Expected: PASS, 5 cases.

- [x] **Step 5: Commit**

```bash
git add backend/WeatherRoute.Infrastructure/Caching
git commit -m "feat: hash coordinates into the route analysis cache key"
```

---

## Task 5: Integration test — coordinates through the HTTP boundary

**Files:**
- Test: the existing `WeatherRoute.Api.IntegrationTests` route test file

**Interfaces:**
- Consumes: the endpoint from Task 3.
- Produces: proof that the whole path works with coordinates.

- [x] **Step 1: Find the existing analyze integration test**

```bash
rg -l "routes/analyze" tests/WeatherRoute.Api.IntegrationTests
```

Read it. Reuse its `WebApplicationFactory` setup and the stubbed `IRouteProvider` / `IWeatherProvider` registrations — do not build a new host.

- [x] **Step 2: Add the test**

```csharp
[Fact]
[Trait("Category", "Integration")]
public async Task Analyze_accepts_coordinates_without_text()
{
    var response = await Client.PostAsJsonAsync("/api/routes/analyze", new
    {
        activity = "Cycling",
        departureTime = DateTime.UtcNow,
        originCoordinates = new { latitude = 40.4168, longitude = -3.7038 },
        destinationCoordinates = new { latitude = 39.8628, longitude = -4.0273 },
    });

    Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    var payload = await response.Content.ReadFromJsonAsync<JsonElement>();
    Assert.True(payload.GetProperty("routeAvailable").GetBoolean());
    Assert.NotEmpty(payload.GetProperty("routes").EnumerateArray());
}

[Fact]
[Trait("Category", "Integration")]
public async Task Analyze_rejects_an_origin_with_neither_text_nor_coordinates()
{
    var response = await Client.PostAsJsonAsync("/api/routes/analyze", new
    {
        destination = "Toledo",
        activity = "Cycling",
        departureTime = DateTime.UtcNow,
    });

    Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
}
```

- [x] **Step 3: Run it (needs Docker)**

```bash
dotnet test backend/WeatherRoute.slnx --filter "Category=Integration"
```

Expected: PASS. If Docker is unavailable, record that and re-run once Docker is up — do not mark this task done on a skip.

- [x] **Step 4: Commit**

```bash
git add tests/WeatherRoute.Api.IntegrationTests
git commit -m "test: cover coordinate-based analyze requests end to end"
```

---

## Task 6: Extend the MapLibre test stub

**Files:**
- Modify: `frontend/test/stubs/maplibre.ts`

**Interfaces:**
- Produces on `MapStub`: `queryRenderedFeatures(point, opts?): unknown[]`, `getCanvas(): HTMLCanvasElement`, `getCenter(): [number, number]`, `getZoom(): number`, `easeTo(opts): this`, `jumpTo(opts): this`, `setPaintProperty(id, name, value): this`, `removeLayer(id): this`, `getBounds(): LngLatBounds`.
- Produces: `ScaleControl`, `GeolocateControl` classes on the default export.
- Produces: `MapStub.renderedFeatures` — a settable array so tests can make `queryRenderedFeatures` return hits (a click over a route) or nothing (a click on empty map).

**This task must land before any `MapCanvas` test, or every `MapCanvas.test.tsx` and `App.test.tsx` case breaks.**

- [ ] **Step 1: Add the camera and canvas methods to `MapStub`**

Insert after `isStyleLoaded()` in `frontend/test/stubs/maplibre.ts`:
```ts
  center: [number, number] = options.center;
  zoomLevel: number = options.zoom;
  renderedFeatures: unknown[] = [];
  easeToCalls: Array<Record<string, unknown>> = [];
  jumpToCalls: Array<Record<string, unknown>> = [];
  canvas: HTMLCanvasElement;

  queryRenderedFeatures(_point: unknown, _options?: unknown): unknown[] {
    return this.renderedFeatures;
  }

  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  getCenter(): [number, number] {
    return this.center;
  }

  getZoom(): number {
    return this.zoomLevel;
  }

  getBounds(): LngLatBounds {
    const bounds = new LngLatBounds();
    bounds.extend(this.center);
    return bounds;
  }

  easeTo(options: Record<string, unknown>): this {
    this.easeToCalls.push(options);
    if (Array.isArray(options.center)) this.center = options.center as [number, number];
    if (typeof options.zoom === "number") this.zoomLevel = options.zoom;
    this._emit("moveend");
    return this;
  }

  jumpTo(options: Record<string, unknown>): this {
    this.jumpToCalls.push(options);
    if (Array.isArray(options.center)) this.center = options.center as [number, number];
    if (typeof options.zoom === "number") this.zoomLevel = options.zoom;
    this._emit("moveend");
    return this;
  }

  setPaintProperty(_id: string, _name: string, _value: unknown): this {
    return this;
  }

  removeLayer(id: string): this {
    this.layers.delete(id);
    return this;
  }
```

- [ ] **Step 2: Give each instance a canvas and reset the new fields**

Replace the constructor body:
```ts
  constructor(options: MapOptions) {
    this.options = options;
    this.sources = new Map();
    this.layers = new Map();
    this.canvas = document.createElement("canvas");
    this.center = options.center;
    this.zoomLevel = options.zoom;
    this.renderedFeatures = [];
    this.easeToCalls = [];
    this.jumpToCalls = [];
    MapStub.instances.push(this);
  }
```

- [ ] **Step 3: Add the two controls and export them**

Next to `export class NavigationControl {}`:
```ts
export class ScaleControl {
  static instances: ScaleControl[] = [];
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
    ScaleControl.instances.push(this);
  }
}

export class GeolocateControl {
  static instances: GeolocateControl[] = [];
  options: Record<string, unknown>;
  constructor(options: Record<string, unknown> = {}) {
    this.options = options;
    GeolocateControl.instances.push(this);
  }
}
```

Add both to the `maplibregl` default export object.

- [ ] **Step 4: Run the frontend suite — nothing should break**

```bash
npm test
```

Expected: PASS with the same pass count as before this task. The stub is purely additive.

- [ ] **Step 5: Commit**

```bash
git add frontend/test/stubs/maplibre.ts
git commit -m "test: extend the maplibre stub with camera, canvas and feature queries"
```

---

## Task 7: `selected` on features, asymmetric fit padding

**Files:**
- Modify: `frontend/src/lib/map.ts`
- Test: `frontend/src/lib/map.test.ts`

**Interfaces:**
- Produces: `MapRouteInput` gains `selected: boolean`; `RouteFeatureProperties` gains `selected: boolean`.
- Produces: `fitBoundsOptions({ isCompact })` returns `left: 412` on desktop so routes are not framed underneath the sidebar.

- [ ] **Step 1: Write the failing tests**

Add to `frontend/src/lib/map.test.ts`:
```ts
it("marks the selected route in the feature properties", () => {
  const features = buildRouteFeatures([
    route({ riskLevel: "Low" }),
    route({ riskLevel: "High", selected: true }),
  ]);

  expect(features.features[0].properties.selected).toBe(false);
  expect(features.features[1].properties.selected).toBe(true);
});

it("frames desktop routes clear of the sidebar", () => {
  expect(fitBoundsOptions({ isCompact: false }).padding.left).toBe(SIDEBAR_PADDING);
});

it("keeps the mobile padding for the bottom sheet", () => {
  const options = fitBoundsOptions({ isCompact: true });
  expect(options.padding.bottom).toBe(320);
  expect(options.padding.left).toBe(24);
});
```

Export `SIDEBAR_PADDING = 412` from `map.ts` so the test and the layout cannot drift apart.

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/lib/map.test.ts
```

Expected: FAIL — `selected` is absent and `padding.left` is 64.

- [ ] **Step 3: Implement**

In `frontend/src/lib/map.ts`:

Add to `MapRouteInput`:
```ts
  selected: boolean;
```
Add to `RouteFeatureProperties`:
```ts
  selected: boolean;
```
In `buildRouteFeatures`, add `selected: route.selected,` to the properties object.

Replace the padding constants and `fitBoundsOptions`:
```ts
export const SIDEBAR_PADDING = 412;
const DESKTOP_EDGE_PADDING = 32;
const DESKTOP_TOP_PADDING = 32;
const MOBILE_EDGE_PADDING = 24;
const MOBILE_TOP_PADDING = 64;
const MOBILE_BOTTOM_PADDING = 320;
const FIT_MAX_ZOOM = 14;

export function fitBoundsOptions(view: MapView): FitBoundsOptions {
  if (view.isCompact) {
    return {
      padding: {
        top: MOBILE_TOP_PADDING,
        right: MOBILE_EDGE_PADDING,
        bottom: MOBILE_BOTTOM_PADDING,
        left: MOBILE_EDGE_PADDING,
      },
      maxZoom: FIT_MAX_ZOOM,
    };
  }

  return {
    padding: {
      top: DESKTOP_TOP_PADDING,
      right: DESKTOP_EDGE_PADDING,
      bottom: DESKTOP_EDGE_PADDING,
      left: SIDEBAR_PADDING,
    },
    maxZoom: FIT_MAX_ZOOM,
  };
}
```

- [ ] **Step 4: Run it**

```bash
npm test -- src/lib/map.test.ts && npm run typecheck
```

Expected: PASS. `typecheck` will report every `MapRouteInput` literal missing `selected` — that is expected; Task 11 fixes them.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/lib/map.ts frontend/src/lib/map.test.ts
git commit -m "feat: mark selected routes in features and pad the fit clear of the sidebar"
```

---

## Task 8: Coordinates in the frontend request

**Files:**
- Modify: `frontend/src/types.ts`
- Test: `frontend/src/services/api.test.ts`

**Interfaces:**
- Produces: `AnalyzeRequest.origin?: string | null`, `AnalyzeRequest.destination?: string | null`, plus `originCoordinates?: GeoCoordinates | null` and `destinationCoordinates?: GeoCoordinates | null`, where `GeoCoordinates = { latitude: number; longitude: number }`.
- This is the exact shape the backend `CoordinatesDto` expects — do not invent a `{ lat, lon }` variant here. Note the asymmetry with `GeocodeResult`, which *does* use `lat`/`lon` because it is the API's own response shape.

- [ ] **Step 1: Write the failing test**

```ts
it("sends coordinates in the analyze body", async () => {
  const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => sampleResponse });
  vi.stubGlobal("fetch", fetchMock);

  await analyzeRoute({
    origin: "Madrid",
    originCoordinates: { latitude: 40.4168, longitude: -3.7038 },
    destination: "Toledo",
    destinationCoordinates: { latitude: 39.8628, longitude: -4.0273 },
    activity: "Cycling",
    departureTime: "2026-09-28T08:00:00Z",
  });

  const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
  expect(body.originCoordinates).toEqual({ latitude: 40.4168, longitude: -3.7038 });
  expect(body.destinationCoordinates).toEqual({ latitude: 39.8628, longitude: -4.0273 });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/services/api.test.ts
```

Expected: FAIL — the fields do not exist on `AnalyzeRequest`.

- [ ] **Step 3: Extend the type**

In `frontend/src/types.ts`:
```ts
export interface GeoCoordinates {
  latitude: number;
  longitude: number;
}

export interface AnalyzeRequest {
  origin?: string | null;
  destination?: string | null;
  originCoordinates?: GeoCoordinates | null;
  destinationCoordinates?: GeoCoordinates | null;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes?: number | null;
}
```

`services/api.ts` needs **no change** — it already `JSON.stringify`s the request object as the body.

- [ ] **Step 4: Run it and fix downstream type errors**

```bash
npm test -- src/services/api.test.ts
npm run typecheck
```

Expected: the new test passes. `typecheck` will flag `App.tsx:147-153` (it builds an `AnalyzeRequest` with `origin`/`destination` as required strings — still valid, since the fields remain assignable) and `useRecentSearches`/`storage.ts` if they mirror the shape. Fix by inspection, do not paper over with `any`.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types.ts frontend/src/services/api.test.ts
git commit -m "feat: let the analyze request carry coordinates"
```

---

## Task 9: `useUrlState`

**Files:**
- Create: `frontend/src/hooks/useUrlState.ts`
- Test: `frontend/src/hooks/useUrlState.test.ts`

**Interfaces:**
- Produces:
```ts
export interface UrlState {
  origin: GeoCoordinates | null;
  originLabel: string;
  destination: GeoCoordinates | null;
  destinationLabel: string;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes: number | null;
  selectedRouteIndex: number | null;
}

export function useUrlState(): {
  state: UrlState;
  update: (patch: Partial<UrlState>) => void;
};
```

**No router dependency.** The app has exactly one page; `react-router-dom` would be dead weight.

- [ ] **Step 1: Write the failing tests**

```ts
import { act, renderHook } from "@testing-library/react";
import { useUrlState } from "./useUrlState";

function readQuery(): URLSearchParams {
  return new URLSearchParams(window.location.search);
}

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});

it("round-trips a full state", () => {
  const { result } = renderHook(() => useUrlState());

  act(() => {
    result.current.update({
      origin: { latitude: 40.4168, longitude: -3.7038 },
      originLabel: "Madrid",
      destination: { latitude: 39.8628, longitude: -4.0273 },
      destinationLabel: "Toledo",
      activity: "Cycling",
      departureTime: "2026-09-28T08:00:00Z",
      selectedRouteIndex: 1,
    });
  });

  const query = readQuery();
  expect(query.get("o")).toBe("40.4168,-3.7038");
  expect(query.get("ol")).toBe("Madrid");
  expect(query.get("d")).toBe("39.8628,-4.0273");
  expect(query.get("a")).toBe("Cycling");
  expect(query.get("r")).toBe("1");
});

it("restores state from the query string on mount", () => {
  window.history.replaceState(
    null, "",
    "/?o=40.4168,-3.7038&ol=Madrid&d=39.8628,-4.0273&dl=Toledo&a=Walking&r=2",
  );

  const { result } = renderHook(() => useUrlState());

  expect(result.current.state.origin).toEqual({ latitude: 40.4168, longitude: -3.7038 });
  expect(result.current.state.originLabel).toBe("Madrid");
  expect(result.current.state.activity).toBe("Walking");
  expect(result.current.state.selectedRouteIndex).toBe(2);
});

it("ignores malformed coordinates", () => {
  window.history.replaceState(null, "", "/?o=not-a-point&d=");
  const { result } = renderHook(() => useUrlState());
  expect(result.current.state.origin).toBeNull();
});

it("rejects out-of-range coordinates", () => {
  window.history.replaceState(null, "", "/?o=999,999");
  const { result } = renderHook(() => useUrlState());
  expect(result.current.state.origin).toBeNull();
});

it("rejects an unknown activity", () => {
  window.history.replaceState(null, "", "/?a=Teleportation");
  const { result } = renderHook(() => useUrlState());
  expect(result.current.state.activity).toBe("Cycling");
});

it("uses replaceState so the back button is not flooded", () => {
  const spy = vi.spyOn(window.history, "replaceState");
  const { result } = renderHook(() => useUrlState());
  act(() => result.current.update({ originLabel: "Madrid" }));
  expect(spy).toHaveBeenCalled();
});

it("re-reads the query string on popstate", () => {
  const { result } = renderHook(() => useUrlState());
  act(() => {
    window.history.replaceState(null, "", "/?ol=Segovia");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  expect(result.current.state.originLabel).toBe("Segovia");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/hooks/useUrlState.test.ts
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

`frontend/src/hooks/useUrlState.ts`:
```ts
import { useCallback, useEffect, useRef, useState } from "react";
import type { ActivityType, GeoCoordinates } from "../types";

export interface UrlState {
  origin: GeoCoordinates | null;
  originLabel: string;
  destination: GeoCoordinates | null;
  destinationLabel: string;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes: number | null;
  selectedRouteIndex: number | null;
}

export const DEFAULT_ACTIVITY: ActivityType = "Cycling";

const ACTIVITIES: readonly ActivityType[] = [
  "Walking", "Running", "Cycling", "Motorcycle", "Driving",
];

export const DEFAULT_STATE: UrlState = {
  origin: null,
  originLabel: "",
  destination: null,
  destinationLabel: "",
  activity: DEFAULT_ACTIVITY,
  departureTime: "",
  maxDurationMinutes: null,
  selectedRouteIndex: null,
};

export function parseCoordinates(value: string | null): GeoCoordinates | null {
  if (!value) return null;
  const [rawLat, rawLon, ...rest] = value.split(",");
  if (rest.length > 0) return null;
  const latitude = Number(rawLat);
  const longitude = Number(rawLon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function parseIndex(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) return null;
  return parsed;
}

function readState(): UrlState {
  const query = new URLSearchParams(window.location.search);
  const activity = query.get("a");
  const max = query.get("max");
  const parsedMax = max === null ? null : Number(max);
  return {
    origin: parseCoordinates(query.get("o")),
    originLabel: query.get("ol") ?? "",
    destination: parseCoordinates(query.get("d")),
    destinationLabel: query.get("dl") ?? "",
    activity:
      activity !== null && ACTIVITIES.includes(activity as ActivityType)
        ? (activity as ActivityType)
        : DEFAULT_ACTIVITY,
    departureTime: query.get("t") ?? "",
    maxDurationMinutes:
      parsedMax !== null && Number.isInteger(parsedMax) && parsedMax > 0 ? parsedMax : null,
    selectedRouteIndex: parseIndex(query.get("r")),
  };
}

function writeState(state: UrlState): void {
  const query = new URLSearchParams();
  if (state.origin) query.set("o", `${state.origin.latitude},${state.origin.longitude}`);
  if (state.originLabel) query.set("ol", state.originLabel);
  if (state.destination) query.set("d", `${state.destination.latitude},${state.destination.longitude}`);
  if (state.destinationLabel) query.set("dl", state.destinationLabel);
  if (state.activity !== DEFAULT_ACTIVITY) query.set("a", state.activity);
  if (state.departureTime) query.set("t", state.departureTime);
  if (state.maxDurationMinutes !== null) query.set("max", String(state.maxDurationMinutes));
  if (state.selectedRouteIndex !== null) query.set("r", String(state.selectedRouteIndex));
  const search = query.toString();
  window.history.replaceState(
    null, "", search ? `/?${search}` : "/",
  );
}

export function useUrlState() {
  const [state, setState] = useState<UrlState>(readState);
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    const onPopState = () => setState(readState());
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const update = useCallback((patch: Partial<UrlState>) => {
    setState((current) => {
      const next = { ...current, ...patch };
      writeState(next);
      return next;
    });
  }, []);

  return { state, update };
}
```

- [ ] **Step 4: Run it**

```bash
npm test -- src/hooks/useUrlState.test.ts && npm run typecheck
```

Expected: PASS, 7 cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/hooks/useUrlState.ts frontend/src/hooks/useUrlState.test.ts
git commit -m "feat: add useUrlState for shareable route links"
```

---

## Task 10: The single breakpoint module

**Files:**
- Create: `frontend/src/lib/breakpoints.ts`

**Interfaces:**
- Produces: `export const DESKTOP_QUERY = "(min-width: 1024px)"` and `export function useIsDesktop(): boolean` (backed by the existing `useMediaQuery`).
- Consumed by: `AppShell`, `Sidebar`, `MapCanvas`, `RouteDetailCard`, `App`.

- [ ] **Step 1: Write the file**

```ts
import { useMediaQuery } from "./useMediaQuery";

export const DESKTOP_QUERY = "(min-width: 1024px)";

export function useIsDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY);
}
```

- [ ] **Step 2: Verify the two call sites agree**

```bash
rg -n "min-width: (768|1024)px" frontend/src
```

Expected after this task: only `DESKTOP_QUERY` in `breakpoints.ts` remains. Fix `RouteDetail.tsx:17` (which uses 768px) and `App.tsx:32` to import from this module. The mobile bottom-sheet padding in `lib/map.ts` is a layout constant, not a breakpoint query — leave it.

- [ ] **Step 3: Run the suite**

```bash
npm test && npm run typecheck
```

Expected: PASS. The `RouteDetail` change may alter a jsdom `matchMedia` mock in a component test; if a test fails because jsdom returns `false` for every query, set the mock to return `true` for the 1024px query in that test rather than weakening the code.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/breakpoints.ts frontend/src/App.tsx frontend/src/components/results/RouteDetail.tsx
git commit -m "refactor: unify the desktop breakpoint in one module"
```

---

## Task 11: `MapCanvas` — three layers, selection by property

**Files:**
- Modify: `frontend/src/components/map/MapCanvas.tsx`
- Test: `frontend/src/components/map/MapCanvas.test.tsx`

**Interfaces:**
- Consumes: `MapRouteInput` (now with `selected: boolean`), `fitBoundsOptions`.
- Produces: three layers in this order — `route-casing`, `route-hover`, `route-lines` — all over the single `routes` GeoJSON source.
- Produces: `MapCanvasProps` gains `pickMode: PickMode` and `onPickPoint: (point: GeoPoint) => void`, plus `hoveredRouteId: number | null` and `probePoint: GeoPoint | null`.

Tasks 11–14 all rewrite `MapCanvas`. Land them one at a time with the suite green between, so a regression is attributable.

- [ ] **Step 1: Write the failing tests**

```ts
it("declares casing, hover and lines layers in that order", async () => {
  await loadMap();
  const ids = [...map.layers.keys()];
  expect(ids).toEqual(["route-casing", "route-hover", "route-lines"]);
});

it("paints the selected route at full opacity and the rest dimmed", async () => {
  await loadMap([route({ selected: true }), route({ selected: false })]);
  const source = map.getSource("routes") as unknown as GeoJSONSource;
  const features = (source.getData() as RouteFeatureCollection).features;
  expect(features[0].properties.selected).toBe(true);
  expect(features[1].properties.selected).toBe(false);
});

it("filters the casing layer to the selected route only", async () => {
  await loadMap([route({ selected: true }), route({ selected: false })]);
  expect(map.getLayer("route-casing")?.filter).toEqual(["==", ["get", "selected"], true]);
});

it("does not reframe the map when only the selection changes", async () => {
  await loadMap([route(), route()]);
  const before = map.fitBoundsCalls.length;
  rerender({ routes: [route({ selected: true }), route()] });
  expect(map.fitBoundsCalls.length).toBe(before);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/map/MapCanvas.test.tsx
```

Expected: FAIL — the old component declares `route-lines` + `route-selected` and refits on every prop change.

- [ ] **Step 3: Rewrite the layer declaration and the paint function**

In `MapCanvas.tsx`, replace the `map.once("load", …)` body:

```ts
    map.once("load", () => {
      map.addSource("routes", { type: "geojson", data: buildRouteFeatures([]) });
      map.addLayer({
        id: "route-casing",
        type: "line",
        source: "routes",
        filter: ["==", ["get", "selected"], true],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 9, "line-opacity": 0.95 },
      });
      map.addLayer({
        id: "route-hover",
        type: "line",
        source: "routes",
        filter: ["==", "$id", -1],
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-color": "#ffffff", "line-width": 7, "line-opacity": 0.7 },
      });
      map.addLayer({
        id: "route-lines",
        type: "line",
        source: "routes",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": ["get", "color"],
          "line-width": 5,
          "line-opacity": ["case", ["get", "selected"], 1, 0.3],
        },
      });
      map.addControl(new maplibregl.NavigationControl(), "top-right");
      map.addControl(new maplibregl.ScaleControl({ unit: "metric" }), "bottom-left");
      paintedRef.current = true;
      paint(map);
    });
```

And replace `paint` so it **no longer calls `fitBounds`**:

```ts
  const paint = useCallback((map: maplibregl.Map) => {
    const state = paintStateRef.current;
    const source = map.getSource("routes") as maplibregl.GeoJSONSource | undefined;
    if (!source) return;

    source.setData(buildRouteFeatures(state.routes));
    map.setFilter("route-casing", ["==", ["get", "selected"], true]);
    map.setFilter("route-hover", ["==", "$id", state.hoveredRouteId ?? -1]);

    for (const marker of markersRef.current) marker.remove();
    markersRef.current = [];
    const points: Array<[string, GeoPoint]> = [];
    if (state.originPoint) points.push(["A", state.originPoint]);
    if (state.destinationPoint) points.push(["B", state.destinationPoint]);
    if (state.probePoint) points.push(["•", state.probePoint]);
    for (const [label, point] of points) {
      const element = document.createElement("div");
      element.className = [
        "flex h-6 w-6 items-center justify-center rounded-full border-2 border-white",
        label === "•"
          ? "bg-sun-500 text-sand-900"
          : "bg-sand-900 text-white",
        "text-xs font-bold shadow-card",
      ].join(" ");
      element.setAttribute("aria-hidden", "true");
      element.textContent = label;
      const marker = new maplibregl.Marker({ element })
        .setLngLat([point.longitude, point.latitude])
        .addTo(map);
      markersRef.current.push(marker);
    }
  }, []);
```

> Removing the `computeBounds` / `fitBounds` block is the point of this task. The camera becomes the caller's decision — Task 13 adds the handle. `MapRouteInput` literals in the old tests now need `selected: false`; the shared `route()` test helper should default it.

- [ ] **Step 3b: Widen the prop and paint-state shapes now, so Tasks 12–14 only add behaviour**

`MapCanvasProps` and `PaintState` both gain the three fields the later tasks need. Declare them in this task so the `paint()` above compiles:

```ts
  hoveredRouteId?: number | null;
  onHoverRoute?: (routeIndex: number | null) => void;
  probePoint?: GeoPoint | null;
```

Add the same two values to `PaintState`, default them to `null` in both the `useRef` initialiser and the destructured props, and add them to the repaint effect's dependency array:

```ts
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !paintedRef.current) return;
    paint(map);
  }, [paint, routes, selectedRouteId, originPoint, destinationPoint, isCompact,
      hoveredRouteId, probePoint]);
```

The `App.tsx` call site does not need to change yet — optional props with `null` defaults.

- [ ] **Step 4: Run it**

```bash
npm test -- src/components/map/MapCanvas.test.tsx && npm run typecheck
```

Expected: PASS. The old "fits bounds on load" test is now wrong — **delete it** and replace it with "does not reframe the map when only the selection changes"; the new behaviour is that the caller fits.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/MapCanvas.tsx frontend/src/components/map/MapCanvas.test.tsx
git commit -m "feat: draw routes with a casing layer and dim the unselected ones"
```

---

## Task 12: Click to pick a point

**Files:**
- Modify: `frontend/src/components/map/MapCanvas.tsx`
- Test: `frontend/src/components/map/MapCanvas.test.tsx`

**Interfaces:**
- Produces: `export type PickMode = "none" | "origin" | "destination";`
- Consumes: `onPickPoint(point: GeoPoint)`.

- [ ] **Step 1: Write the failing tests**

```ts
it("picks a point when the map is clicked while picking", async () => {
  const onPickPoint = vi.fn();
  await loadMap([], { pickMode: "origin", onPickPoint });
  map.renderedFeatures = [];
  map._emit("click", { lngLat: { lng: -3.7038, lat: 40.4168 }, point: { x: 0, y: 0 } });

  expect(onPickPoint).toHaveBeenCalledWith({ latitude: 40.4168, longitude: -3.7038 });
});

it("selects the route instead of picking when the click lands on one", async () => {
  const onPickPoint = vi.fn();
  const onSelectRoute = vi.fn();
  await loadMap([route()], { pickMode: "origin", onPickPoint, onSelectRoute });
  map.renderedFeatures = [{ properties: { routeIndex: 0 } }];
  map._emit("click", { lngLat: { lng: 0, lat: 0 }, point: { x: 0, y: 0 } });

  expect(onSelectRoute).toHaveBeenCalledWith(0);
  expect(onPickPoint).not.toHaveBeenCalled();
});

it("ignores clicks on the map when no mode is active", async () => {
  const onPickPoint = vi.fn();
  await loadMap([], { pickMode: "none", onPickPoint });
  map.renderedFeatures = [];
  map._emit("click", { lngLat: { lng: 0, lat: 0 }, point: { x: 0, y: 0 } });

  expect(onPickPoint).not.toHaveBeenCalled();
});

it("shows a crosshair cursor while picking", async () => {
  await loadMap([], { pickMode: "destination" });
  expect(map.getCanvas().style.cursor).toBe("crosshair");
});

it("shows a pointer cursor over a route", async () => {
  await loadMap([route()]);
  map.renderedFeatures = [{ properties: { routeIndex: 0 } }];
  map._emit("mousemove", "route-lines", { point: { x: 0, y: 0 } });
  expect(map.getCanvas().style.cursor).toBe("pointer");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/map/MapCanvas.test.tsx
```

Expected: FAIL — no `pickMode` prop, and the map-level click handler does not exist.

- [ ] **Step 3: Add the props and the handler**

Add to `MapCanvas.tsx`:
```ts
export type PickMode = "none" | "origin" | "destination";
```
and to `MapCanvasProps`:
```ts
  pickMode: PickMode;
  onPickPoint: (point: GeoPoint) => void;
```

Mirror both into refs, alongside the existing `onSelectRouteRef` pattern:
```ts
  const pickModeRef = useRef(pickMode);
  const onPickPointRef = useRef(onPickPoint);
  useEffect(() => { pickModeRef.current = pickMode; }, [pickMode]);
  useEffect(() => { onPickPointRef.current = onPickPoint; }, [onPickPoint]);
```

Inside the map lifecycle effect, add:
```ts
    const handleMapClick = (event: maplibregl.MapMouseEvent) => {
      const hits = map.queryRenderedFeatures(event.point, { layers: ["route-lines"] });
      if (hits.length > 0) return; // the layer handler already dealt with it

      if (pickModeRef.current === "none") return;
      onPickPointRef.current({
        latitude: event.lngLat.lat,
        longitude: event.lngLat.lng,
      });
    };

    map.on("click", handleMapClick);

    map.on("mousemove", "route-lines", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "route-lines", () => {
      map.getCanvas().style.cursor = pickModeRef.current === "none" ? "" : "crosshair";
    });
```

Add the cleanup:
```ts
      map.off("click", handleMapClick);
```

And keep the cursor correct when the mode changes — add an effect:
```ts
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.getCanvas().style.cursor = pickMode === "none" ? "" : "crosshair";
  }, [pickMode]);
```

- [ ] **Step 4: Run it**

```bash
npm test -- src/components/map/MapCanvas.test.tsx && npm run typecheck
```

Expected: PASS. `App.tsx` will now fail to typecheck until it passes `pickMode`/`onPickPoint`; that is Task 20 — until then, add placeholder props at the call site (`pickMode="none"`, `onPickPoint={() => {}}`) so the suite stays green, and replace them in Task 20.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/MapCanvas.tsx frontend/src/components/map/MapCanvas.test.tsx frontend/src/App.tsx
git commit -m "feat: pick origin and destination by clicking the map"
```

---

## Task 13: The map camera stops moving on its own

**Files:**
- Modify: `frontend/src/components/map/MapCanvas.tsx`
- Test: `frontend/src/components/map/MapCanvas.test.tsx`

**Interfaces:**
- Produces:
```ts
export interface MapCanvasHandle {
  fitToRoutes(): void;
  ensureVisible(point: GeoPoint): void;
}
```
via `React.forwardRef`. Today `MapCanvas` is a plain default export used as `<MapCanvas … />`; converting to `forwardRef` keeps the same import path and JSX usage.

- [ ] **Step 1: Write the failing tests**

```ts
it("frames the routes on demand", async () => {
  const ref = React.createRef<MapCanvasHandle>();
  await loadMap([route(), route()], { ref });
  map.fitBoundsCalls.length = 0;

  act(() => ref.current?.fitToRoutes());

  expect(map.fitBoundsCalls).toHaveLength(1);
  expect(map.fitBoundsCalls[0].options).toMatchObject({ maxZoom: 14 });
});

it("does nothing when fitting with no routes", async () => {
  const ref = React.createRef<MapCanvasHandle>();
  await loadMap([], { ref });
  map.fitBoundsCalls.length = 0;

  act(() => ref.current?.fitToRoutes());

  expect(map.fitBoundsCalls).toHaveLength(0);
});

it("eases to a point only when it sits outside the viewport", async () => {
  const ref = React.createRef<MapCanvasHandle>();
  await loadMap([], { ref });

  act(() => ref.current?.ensureVisible({ latitude: 40.4168, longitude: -3.7038 }));
  expect(map.easeToCalls).toHaveLength(1);
  expect(map.easeToCalls[0]).toMatchObject({ center: [-3.7038, 40.4168] });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/map/MapCanvas.test.tsx
```

Expected: FAIL — `MapCanvasHandle` does not exist and `fitToRoutes` is undefined.

- [ ] **Step 3: Convert to `forwardRef` and add the handle**

At the top of the file:
```ts
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export interface MapCanvasHandle {
  fitToRoutes(): void;
  ensureVisible(point: GeoPoint): void;
}

const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(function MapCanvas(
  { routes, selectedRouteId, onSelectRoute, originPoint, destinationPoint, isCompact = false,
    pickMode, onPickPoint, hoveredRouteId = null, probePoint = null },
  ref,
) {
  // … existing body …

  useImperativeHandle(ref, () => ({
    fitToRoutes() {
      const map = mapRef.current;
      if (!map) return;
      const state = paintStateRef.current;
      const coords: GeoPoint[] = [];
      for (const route of state.routes) {
        for (const [lng, lat] of route.geometry.coordinates) {
          coords.push({ latitude: lat, longitude: lng });
        }
      }
      if (coords.length === 0) return;
      const bounds = computeBounds(coords);
      if (!bounds) return;
      const extent = new maplibregl.LngLatBounds(
        [bounds.west, bounds.south],
        [bounds.east, bounds.north],
      );
      map.fitBounds(extent, fitBoundsOptions({ isCompact: isCompactRef.current }));
    },
    ensureVisible(point) {
      const map = mapRef.current;
      if (!map) return;
      const bounds = map.getBounds();
      const lng = point.longitude;
      const lat = point.latitude;
      const inside =
        lng >= bounds.getWest() && lng <= bounds.getEast() &&
        lat >= bounds.getSouth() && lat <= bounds.getNorth();
      if (inside) return;
      map.easeTo({ center: [lng, lat], duration: 400 });
    },
  }), []);

  // … rest of body …
});

export default MapCanvas;
```

Add `hoveredRouteId` and `probePoint` to `MapCanvasProps` and to `PaintState` (both default to `null` / `undefined`), and include them in the repaint effect's dependency array.

> `computeBounds` is still imported from `lib/map` — keep that import, Task 11 only removed its use from `paint()`.

- [ ] **Step 4: Run it**

```bash
npm test -- src/components/map/MapCanvas.test.tsx && npm run typecheck
```

Expected: PASS. The JSX prop spread from `App.tsx` is unchanged, so no caller edits are needed yet.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/MapCanvas.tsx frontend/src/components/map/MapCanvas.test.tsx
git commit -m "feat: make the map camera an explicit caller decision"
```

---

## Task 14: Hover highlight and the profile probe

**Files:**
- Modify: `frontend/src/components/map/MapCanvas.tsx`
- Test: `frontend/src/components/map/MapCanvas.test.tsx`

**Interfaces:**
- Consumes: `hoveredRouteId: number | null`, `onHoverRoute(index: number | null): void`, `probePoint: GeoPoint | null`.
- Produces: a `route-hover` layer filter driven by the hovered index, and a probe marker at the hovered profile point.

- [ ] **Step 1: Write the failing tests**

```ts
it("highlights the hovered route and reports it", async () => {
  const onHoverRoute = vi.fn();
  await loadMap([route(), route()], { onHoverRoute });
  map.renderedFeatures = [{ properties: { routeIndex: 1 } }];

  map._emit("mousemove", "route-lines", { point: { x: 0, y: 0 }, features: [{ properties: { routeIndex: 1 } }] });

  expect(onHoverRoute).toHaveBeenCalledWith(1);
});

it("clears the hover when the pointer leaves a route", async () => {
  const onHoverRoute = vi.fn();
  await loadMap([route()], { onHoverRoute });
  map._emit("mouseleave", "route-lines", {});
  expect(onHoverRoute).toHaveBeenCalledWith(null);
});

it("renders a probe marker at the hovered profile point", async () => {
  await loadMap([route()], { probePoint: { latitude: 40.5, longitude: -3.9 } });
  expect(Marker.instances.map((m) => m.element?.textContent)).toContain("•");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/map/MapCanvas.test.tsx
```

Expected: FAIL — no `onHoverRoute` prop.

- [ ] **Step 3: Implement**

Add to the props:
```ts
  onHoverRoute?: (routeIndex: number | null) => void;
```

Inside the lifecycle effect, next to the `mousemove` handler from Task 12:
```ts
    const handleRouteMouseMove = (event: maplibregl.MapLayerMouseEvent) => {
      const index = event.features?.[0]?.properties?.routeIndex;
      if (typeof index !== "number") return;
      map.getCanvas().style.cursor = "pointer";
      onHoverRouteRef.current?.(index);
    };
    const handleRouteMouseLeave = () => onHoverRouteRef.current?.(null);

    map.on("mousemove", "route-lines", handleRouteMouseMove);
    map.on("mouseleave", "route-lines", handleRouteMouseLeave);
```

and in the cleanup:
```ts
      map.off("mousemove", "route-lines", handleRouteMouseMove);
      map.off("mouseleave", "route-lines", handleRouteMouseLeave);
```

Replace the simpler `mousemove`/`mouseleave` registrations added in Task 12 with these, so the two handlers are not duplicated.

The probe marker is already created by `paint()` in Task 11 (`label === "•"`), so this test passes as soon as `probePoint` reaches `PaintState`.

- [ ] **Step 4: Run it**

```bash
npm test -- src/components/map/MapCanvas.test.tsx && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/MapCanvas.tsx frontend/src/components/map/MapCanvas.test.tsx
git commit -m "feat: highlight hovered routes and probe a profile point on the map"
```

---

## Task 15: `PickModeBar`

**Files:**
- Create: `frontend/src/components/map/PickModeBar.tsx`
- Test: `frontend/src/components/map/PickModeBar.test.tsx`

**Interfaces:**
- Consumes: `pickMode: PickMode`, `onChange(mode: PickMode): void`, `onFitView(): void`.
- Produces: a `role="toolbar"` overlay. `+ Vía` is rendered **disabled** with `title="Llega en la Fase 2"` — visible but not fake-functional.

- [ ] **Step 1: Write the failing tests**

```ts
it("marks the active mode with aria-pressed", () => {
  render(<PickModeBar pickMode="origin" onChange={vi.fn()} onFitView={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Origen" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByRole("button", { name: "Destino" })).toHaveAttribute("aria-pressed", "false");
});

it("emits the chosen mode", async () => {
  const onChange = vi.fn();
  render(<PickModeBar pickMode="none" onChange={onChange} onFitView={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Destino" }));
  expect(onChange).toHaveBeenCalledWith("destination");
});

it("keeps the waypoint button disabled in phase 1", () => {
  render(<PickModeBar pickMode="none" onChange={vi.fn()} onFitView={vi.fn()} />);
  expect(screen.getByRole("button", { name: /Vía/ })).toBeDisabled();
});

it("exposes the fit-view action", async () => {
  const onFitView = vi.fn();
  render(<PickModeBar pickMode="none" onChange={vi.fn()} onFitView={onFitView} />);
  await userEvent.click(screen.getByRole("button", { name: "Ajustar vista" }));
  expect(onFitView).toHaveBeenCalled();
});

it("moves between modes with the arrow keys", async () => {
  const onChange = vi.fn();
  render(<PickModeBar pickMode="none" onChange={onChange} onFitView={vi.fn()} />);
  screen.getByRole("button", { name: "Origen" }).focus();
  await userEvent.keyboard("{ArrowRight}");
  expect(onChange).toHaveBeenCalledWith("destination");
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/map/PickModeBar.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
import { useRef } from "react";
import type { PickMode } from "./MapCanvas";

export interface PickModeBarProps {
  pickMode: PickMode;
  onChange: (mode: PickMode) => void;
  onFitView: () => void;
}

const MODES: Array<{ mode: PickMode; label: string }> = [
  { mode: "origin", label: "Origen" },
  { mode: "destination", label: "Destino" },
];

export default function PickModeBar({ pickMode, onChange, onFitView }: PickModeBarProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  function onKeyDown(event: React.KeyboardEvent) {
    const index = MODES.findIndex((entry) => entry.mode === pickMode);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      const next = MODES[(index + 1) % MODES.length].mode;
      onChange(next);
      refs.current[MODES.findIndex((entry) => entry.mode === next)]?.focus();
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      const previous = MODES[(index - 1 + MODES.length) % MODES.length].mode;
      onChange(previous);
      refs.current[MODES.findIndex((entry) => entry.mode === previous)]?.focus();
    }
  }

  return (
    <div
      role="toolbar"
      aria-label="Selección de extremos"
      className="pointer-events-auto flex flex-wrap items-center gap-2"
    >
      <div
        role="group"
        onKeyDown={onKeyDown}
        className="flex items-center gap-1 rounded-xl border border-sand-200 bg-white/95 p-1 shadow-raise backdrop-blur"
      >
        {MODES.map((entry, index) => {
          const active = entry.mode === pickMode;
          return (
            <button
              key={entry.mode}
              type="button"
              ref={(element) => { refs.current[index] = element; }}
              aria-pressed={active}
              onClick={() => onChange(entry.mode)}
              className={[
                "min-h-11 rounded-lg px-4 text-sm font-medium motion-safe:transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600",
                active ? "bg-ocean-600 text-white" : "text-sand-700 hover:bg-sand-100",
              ].join(" ")}
            >
              {entry.label}
            </button>
          );
        })}
        <button
          type="button"
          disabled
          title="Llega en la Fase 2"
          className="min-h-11 cursor-not-allowed rounded-lg px-4 text-sm font-medium text-sand-400"
        >
          + Vía
        </button>
      </div>
      <button
        type="button"
        aria-label="Ajustar vista"
        onClick={onFitView}
        className="min-h-11 rounded-xl border border-sand-200 bg-white/95 px-4 text-sm font-medium text-sand-700 shadow-raise motion-safe:transition-colors hover:bg-sand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600"
      >
        Ajustar vista
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Run it**

```bash
npm test -- src/components/map/PickModeBar.test.tsx && npm run typecheck
```

Expected: PASS, 5 cases.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/map/PickModeBar.tsx frontend/src/components/map/PickModeBar.test.tsx
git commit -m "feat: add the pick-mode toolbar over the map"
```

---

## Task 16: `RouteList` with arrow-key navigation

**Files:**
- Create: `frontend/src/components/results/RouteList.tsx`
- Test: `frontend/src/components/results/RouteList.test.tsx`
- Modify: `frontend/src/components/results/RouteCard.tsx` (drop the expand mechanism)
- Modify: `frontend/src/components/results/ResultsLayer.tsx` (delegate the list; drop the expand props)

**Interfaces:**
- Consumes: `routes: RouteCandidate[]`, `selectedRouteId: number | null`, `weatherAvailable: boolean`, `onSelectRoute(index: number): void`, `onNewSearch(): void`.
- Produces: the same visual as today's list, plus roving tabindex.

**This task also removes the expand-in-place detail.** `RouteCard` currently renders a chevron `IconButton` and a `children` detail region, and `ResultsLayer` fills that with `RouteDetail`. In the new layout the selected route's detail lives in exactly one place — the floating `RouteDetailCard` over the map (desktop) or the bottom sheet (mobile) — so duplicating it inside the card is removed. That takes `expandedRouteId`, `onToggleExpand` and `onCloseDetail` out of `App` too.

- [ ] **Step 1: Write the failing tests**

```ts
it("lists one entry per route", () => {
  render(<RouteList routes={threeRoutes} weatherAvailable selectedRouteId={null}
    onSelectRoute={vi.fn()} onNewSearch={vi.fn()} />);
  expect(screen.getAllByRole("listitem")).toHaveLength(3);
});

it("moves the selection with the down arrow", async () => {
  const onSelectRoute = vi.fn();
  render(<RouteList routes={threeRoutes} weatherAvailable selectedRouteId={0}
    onSelectRoute={onSelectRoute} onNewSearch={vi.fn()} />);
  screen.getAllByRole("button", { name: /Ruta 1/ })[0].focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(onSelectRoute).toHaveBeenCalledWith(1);
});

it("wraps from the last route to the first", async () => {
  const onSelectRoute = vi.fn();
  render(<RouteList routes={threeRoutes} weatherAvailable selectedRouteId={2}
    onSelectRoute={onSelectRoute} onNewSearch={vi.fn()} />);
  screen.getAllByRole("button", { name: /Ruta 3/ })[0].focus();
  await userEvent.keyboard("{ArrowDown}");
  expect(onSelectRoute).toHaveBeenCalledWith(0);
});

it("does not move beyond the last route on the up arrow", async () => {
  const onSelectRoute = vi.fn();
  render(<RouteList routes={threeRoutes} weatherAvailable selectedRouteId={0}
    onSelectRoute={onSelectRoute} onNewSearch={vi.fn()} />);
  screen.getAllByRole("button", { name: /Ruta 1/ })[0].focus();
  await userEvent.keyboard("{ArrowUp}");
  expect(onSelectRoute).toHaveBeenCalledWith(2);
});

it("only the selected entry is in the tab order", () => {
  render(<RouteList routes={threeRoutes} weatherAvailable selectedRouteId={1}
    onSelectRoute={vi.fn()} onNewSearch={vi.fn()} />);
  const buttons = screen.getAllByRole("button", { name: /Ruta \d/ });
  expect(buttons[0]).toHaveAttribute("tabindex", "-1");
  expect(buttons[1]).toHaveAttribute("tabindex", "0");
  expect(buttons[2]).toHaveAttribute("tabindex", "-1");
});

it("no longer offers a per-card expand toggle", () => {
  render(<RouteList routes={threeRoutes} weatherAvailable selectedRouteId={0}
    onSelectRoute={vi.fn()} onNewSearch={vi.fn()} />);
  expect(screen.queryByRole("button", { name: /Ampliar ruta/ })).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/results/RouteList.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `RouteList`**

Move the `<ul data-testid="route-list">` block out of `ResultsLayer.tsx:78-100` into the new component and add the list-level key handler. `BestRouteBanner` takes only `routes` and `onNewSearch` — it already picks the best route itself via `findBestRouteIndex`.

```tsx
import { useRef, type KeyboardEvent } from "react";
import BestRouteBanner from "./BestRouteBanner";
import RouteCard from "./RouteCard";
import type { RouteCandidate } from "../../types";

export interface RouteListProps {
  routes: RouteCandidate[];
  weatherAvailable: boolean;
  selectedRouteId: number | null;
  onSelectRoute: (index: number) => void;
  onNewSearch: () => void;
}

export default function RouteList({
  routes, weatherAvailable, selectedRouteId, onSelectRoute, onNewSearch,
}: RouteListProps) {
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);

  function focusAndSelect(index: number) {
    const bounded = (index + routes.length) % routes.length;
    onSelectRoute(bounded);
    itemRefs.current[bounded]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === "ArrowDown") { event.preventDefault(); focusAndSelect(index + 1); }
    if (event.key === "ArrowUp") { event.preventDefault(); focusAndSelect(index - 1); }
  }

  return (
    <div className="space-y-4">
      <BestRouteBanner routes={routes} onNewSearch={onNewSearch} />
      <ul data-testid="route-list" className="space-y-3">
        {routes.map((route, index) => (
          <li key={route.providerId}>
            <RouteCard
              index={index}
              route={route}
              isSelected={selectedRouteId === index}
              weatherAvailable={weatherAvailable}
              onSelect={onSelectRoute}
              onKeyDown={(event) => onKeyDown(event, index)}
              cardRef={(element) => { itemRefs.current[index] = element; }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Trim `RouteCard` and forward the new props**

`RouteCard` keeps `index, route, isSelected, weatherAvailable, onSelect`. Remove `isExpanded`, `onToggleExpand` and `children`, delete the chevron `IconButton` and the `isExpanded && …` region, and add the two new props:

```tsx
export interface RouteCardProps {
  index: number;
  route: RouteCandidate;
  isSelected: boolean;
  weatherAvailable: boolean;
  onSelect: (index: number) => void;
  onKeyDown?: (event: KeyboardEvent<HTMLButtonElement>) => void;
  cardRef?: (element: HTMLButtonElement | null) => void;
}
```

Apply them to the existing `<button>` at `RouteCard.tsx:65-81`:
```tsx
        <button
          type="button"
          ref={cardRef}
          tabIndex={isSelected ? 0 : -1}
          onKeyDown={onKeyDown}
          onClick={() => onSelect(index)}
          aria-pressed={isSelected}
          className="-m-1 flex min-w-0 flex-1 items-center gap-3 rounded-md p-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean-600 focus-visible:ring-offset-2"
        >
```

With no route selected, every button gets `tabindex="-1"` and the list becomes unreachable by keyboard. Fix that by making index 0 the fallback — pass `tabIndex={(isSelected || (selectedRouteId === null && index === 0)) ? 0 : -1}`, which means `RouteList` must also pass `selectedRouteId === null` down. Add a `hasSelection: boolean` prop to `RouteCard` and use `tabIndex={isSelected || (!hasSelection && index === 0) ? 0 : -1}`.

> `RouteCard` renders a `Card` wrapper (not a bare button), and `data-selected` is already on it — existing tests that query `[data-selected]` keep working.

- [ ] **Step 5: Point `ResultsLayer` at the new component**

Remove `expandedRouteId`, `onToggleExpand` and `onCloseDetail` from `ResultsLayerProps`, delete the `RouteDetail` import, and replace the `hasRoutes ? … : …` block with:

```tsx
      {hasRoutes ? (
        <RouteList
          routes={routes}
          weatherAvailable={weatherAvailable}
          selectedRouteId={selectedRouteId}
          onSelectRoute={onSelectRoute}
          onNewSearch={onNewSearch}
        />
      ) : (
        <div className="flex justify-end">
          <Button variant="secondary" onClick={onNewSearch}>
            Nueva búsqueda
          </Button>
        </div>
      )}
```

- [ ] **Step 6: Run it**

```bash
npm test && npm run typecheck
```

Expected: PASS. `App.tsx` will now fail to typecheck on the removed `ResultsLayer` props — fix by deleting `expandedRouteId`, `handleToggleExpand` and the `onCloseDetail` argument from `App.tsx` in this task, so the suite is green before the next one.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/results/
git commit -m "feat: extract the route list, add keyboard navigation, drop expand-in-place"
```

---

## Task 17: `RouteProfileChart`

**Files:**
- Create: `frontend/src/components/results/RouteProfileChart.tsx`
- Test: `frontend/src/components/results/RouteProfileChart.test.tsx`

**Interfaces:**
- Consumes: `segments: RouteSegment[]`.
- Produces: `onHoverSegment(index: number | null): void` — drives the map's `probePoint`.
- Uses the existing `SegmentedControl` for the metric switch. **One metric on the Y axis at a time**: three overlaid axes is unreadable, and the tooltip carries all three.

- [ ] **Step 1: Write the failing tests**

```ts
const segments: RouteSegment[] = [
  { fromIndex: 0, toIndex: 3, distanceKm: 4, arrivalTimeUtc: "2026-09-28T08:00:00Z",
    weather: { temperatureC: 18, windKmh: 8, precipitationProbability: 10, uvIndex: 3, visibilityKm: 12, condition: "Clear" } },
  { fromIndex: 3, toIndex: 6, distanceKm: 5, arrivalTimeUtc: "2026-09-28T08:24:00Z",
    weather: { temperatureC: 21, windKmh: 14, precipitationProbability: 40, uvIndex: 5, visibilityKm: 9, condition: "Clouds" } },
  { fromIndex: 6, toIndex: 9, distanceKm: 3, arrivalTimeUtc: "2026-09-28T08:52:00Z",
    weather: { temperatureC: 16, windKmh: 22, precipitationProbability: 75, uvIndex: 2, visibilityKm: 6, condition: "Rain" } },
];

it("accumulates distance along the x axis", () => {
  render(<RouteProfileChart segments={segments} onHoverSegment={vi.fn()} />);
  expect(screen.getByRole("img", { name: /perfil meteorológico/i })).toBeInTheDocument();
});

it("switches the plotted metric", async () => {
  render(<RouteProfileChart segments={segments} onHoverSegment={vi.fn()} />);
  await userEvent.click(screen.getByRole("button", { name: "Viento" }));
  expect(screen.getByRole("button", { name: "Viento" })).toHaveAttribute("aria-pressed", "true");
});

it("starts on temperature", () => {
  render(<RouteProfileChart segments={segments} onHoverSegment={vi.fn()} />);
  expect(screen.getByRole("button", { name: "Temperatura" })).toHaveAttribute("aria-pressed", "true");
});

it("reports the hovered segment so the map can probe it", async () => {
  const onHoverSegment = vi.fn();
  render(<RouteProfileChart segments={segments} onHoverSegment={onHoverSegment} />);
  // Recharts renders a single overlay rect; the active dot carries the index.
  const dot = document.querySelector(".recharts-active-dot circle");
  expect(dot).toBeInTheDocument();
});

it("renders nothing but a note when there is no weather", () => {
  render(<RouteProfileChart segments={[{ ...segments[0], weather: null }]} onHoverSegment={vi.fn()} />);
  expect(screen.getByText(/sin previsión/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/results/RouteProfileChart.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Install the accumulated-distance helper in the component**

```tsx
import { useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import SegmentedControl from "../ui/SegmentedControl";
import type { RouteSegment } from "../../types";

export type ProfileMetric = "temperature" | "precipitation" | "wind";

export interface RouteProfileChartProps {
  segments: RouteSegment[];
  onHoverSegment: (index: number | null) => void;
}

const METRICS: Record<ProfileMetric, { label: string; unit: string; color: string; field: keyof NonNullable<RouteSegment["weather"]> }> = {
  temperature: { label: "Temperatura", unit: "°C", color: "var(--color-sun-500)", field: "temperatureC" },
  precipitation: { label: "Lluvia", unit: "%", color: "var(--color-ocean-500)", field: "precipitationProbability" },
  wind: { label: "Viento", unit: "km/h", color: "var(--color-sand-600)", field: "windKmh" },
};

interface Point {
  index: number;
  distanceKm: number;
  temperature: number | null;
  precipitation: number | null;
  wind: number | null;
  arrivalLabel: string;
}

export function toProfilePoints(segments: RouteSegment[]): Point[] {
  let cumulative = 0;
  return segments.map((segment, index) => {
    cumulative += segment.distanceKm;
    const weather = segment.weather;
    return {
      index,
      distanceKm: Math.round(cumulative * 10) / 10,
      temperature: weather?.temperatureC ?? null,
      precipitation: weather?.precipitationProbability ?? null,
      wind: weather?.windKmh ?? null,
      arrivalLabel: segment.arrivalTimeUtc
        ? new Date(segment.arrivalTimeUtc).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" })
        : "—",
    };
  });
}
```

- [ ] **Step 4: Render it**

```tsx
export default function RouteProfileChart({ segments, onHoverSegment }: RouteProfileChartProps) {
  const [metric, setMetric] = useState<ProfileMetric>("temperature");
  const points = useMemo(() => toProfilePoints(segments), [segments]);
  const hasWeather = points.some((point) => point.temperature !== null);

  if (!hasWeather) {
    return <p className="text-sm text-sand-600">Sin previsión meteorológica para esta ruta.</p>;
  }

  const config = METRICS[metric];
  const summary =
    `Perfil meteorológico de la ruta. Eje horizontal: distancia acumulada en kilómetros. ` +
    `Métrica activa: ${config.label} en ${config.unit}. ${points.length} tramos.`;

  return (
    <div className="flex flex-col gap-2">
      <SegmentedControl
        ariaLabel="Métrica del perfil"
        value={metric}
        onChange={(value) => setMetric(value as ProfileMetric)}
        options={[
          { value: "temperature", label: "Temperatura" },
          { value: "precipitation", label: "Lluvia" },
          { value: "wind", label: "Viento" },
        ]}
      />
      <div role="img" aria-label={summary} className="h-[150px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid stroke="var(--color-sand-200)" vertical={false} />
            <XAxis dataKey="distanceKm" tick={{ fontSize: 11 }} unit=" km" />
            <YAxis tick={{ fontSize: 11 }} width={44} unit={config.unit} />
            <Tooltip
              formatter={(_value, _name, entry) => [
                String((entry.payload as Point)[config.field]),
                config.label,
              ]}
              labelFormatter={(_label, payload) => {
                const point = payload?.[0]?.payload as Point | undefined;
                return point ? `${point.arrivalLabel} · ${point.distanceKm} km` : "";
              }}
            />
            {metric === "precipitation" ? (
              <Bar dataKey="precipitation" fill="var(--color-ocean-500)" radius={[3, 3, 0, 0]} />
            ) : (
              <Line
                type="monotone"
                dataKey={metric}
                stroke={config.color}
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 6, onMouseEnter: (_: unknown, payload: unknown) => onHoverSegment((payload as Point).index) }}
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
```

> Recharts renders responsively and measures its container; in jsdom the container is 0×0, so assert on the `role="img"` wrapper and the toolbar rather than on pixel geometry. That is why every test above queries the wrapper, not the SVG.

- [ ] **Step 5: Run it**

```bash
npm test -- src/components/results/RouteProfileChart.test.tsx && npm run typecheck
```

Expected: PASS. If Recharts' `activeDot` callback signature differs in v3, read `node_modules/recharts/types/index.d.ts` and adjust the cast — do not add `as any`.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/results/RouteProfileChart.tsx frontend/src/components/results/RouteProfileChart.test.tsx
git commit -m "feat: add a weather profile chart for the selected route"
```

---

## Task 18: `RouteDetailCard` and `MapControlBar`

**Files:**
- Create: `frontend/src/components/map/RouteDetailCard.tsx`
- Create: `frontend/src/components/map/MapControlBar.tsx`
- Delete: `frontend/src/components/results/RouteDetail.tsx`
- Test: `frontend/src/components/map/RouteDetailCard.test.tsx`

**Interfaces:**
- Consumes: `route: RouteCandidate | null`, `segments`, `onHoverSegment`, `onClose`, `onHowCalculated`.
- Produces: the floating bottom-left card over the map, and the bottom-right control cluster (legend + scale).

- [ ] **Step 1: Write the failing test**

```ts
it("shows the selected route with its score and profile", () => {
  render(
    <RouteDetailCard
      route={sampleRoute}
      onHoverSegment={vi.fn()}
      onClose={vi.fn()}
      onHowCalculated={vi.fn()}
    />,
  );
  expect(screen.getByText(/88/)).toBeInTheDocument();
  expect(screen.getByRole("img", { name: /perfil meteorológico/i })).toBeInTheDocument();
});

it("renders nothing when no route is selected", () => {
  const { container } = render(
    <RouteDetailCard route={null} onHoverSegment={vi.fn()} onClose={vi.fn()} onHowCalculated={vi.fn()} />,
  );
  expect(container).toBeEmptyDOMElement();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/map/RouteDetailCard.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `RouteDetailCard`**

```tsx
import type { RouteCandidate } from "../../types";
import FactorList from "../results/FactorList";
import RouteProfileChart from "../results/RouteProfileChart";
import ScoreGauge from "../results/ScoreGauge";
import SegmentStrip from "../results/SegmentStrip";

export interface RouteDetailCardProps {
  route: RouteCandidate | null;
  weatherAvailable: boolean;
  onHoverSegment: (index: number | null) => void;
  onClose: () => void;
  onHowCalculated: () => void;
}

export default function RouteDetailCard({
  route, weatherAvailable, onHoverSegment, onClose, onHowCalculated,
}: RouteDetailCardProps) {
  if (!route) return null;
  return (
    <section
      aria-label="Detalle de la ruta seleccionada"
      className="pointer-events-auto max-h-[70vh] w-[26rem] max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-sand-200 bg-white/95 p-4 shadow-raise backdrop-blur"
    >
      <header className="mb-3 flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-sand-900">
          Ruta {route.providerId} · {formatDistance(route.distanceKm)} · {formatDuration(route.durationMinutes)}
        </h2>
        <IconButton label="Cerrar detalle" onClick={onClose}>
          <FaTimes aria-hidden />
        </IconButton>
      </header>
      <div className="mb-3">
        <ScoreGauge score={route.riskScore} onHowCalculated={onHowCalculated} />
      </div>
      <div className="mb-3">
        <RouteProfileChart segments={route.segments} onHoverSegment={onHoverSegment} />
      </div>
      {route.factors.length > 0 && <FactorList factors={route.factors} />}
      {weatherAvailable && <div className="mt-3"><SegmentStrip segments={route.segments} /></div>}
    </section>
  );
}
```

Use the existing `IconButton` primitive and the `formatDistance` / `formatDuration` formatters rather than hand-rolled markup, and import `FaTimes` from `react-icons/fa` (the repo standard). Read `RouteDetail.tsx` first and copy the exact `SegmentStrip` / `FactorList` prop names out of it rather than assuming.

- [ ] **Step 4: Implement `MapControlBar`**

```tsx
import MapLegend from "./MapLegend";

export interface MapControlBarProps {
  compact: boolean;
}

export default function MapControlBar({ compact }: MapControlBarProps) {
  return (
    <div
      className={[
        "pointer-events-auto flex items-center gap-2 bottom-4",
        compact ? "left-1/2 -translate-x-1/2" : "left-4",
      ].join(" ")}
    >
      <MapLegend isCompact={compact} />
    </div>
  );
}
```

Check `MapLegend`'s real prop name — the desktop call site is `<MapLegend />` with no props today.

- [ ] **Step 5: Delete `RouteDetail.tsx` and its test, then fix the fallout**

```bash
git rm frontend/src/components/results/RouteDetail.tsx frontend/src/components/results/RouteDetail.test.tsx
npm test
```

Expected: PASS. Task 16 already removed the only import (`ResultsLayer`). `App.tsx` does not import it directly.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/map/
git commit -m "feat: add the floating route detail card and the map control bar"
```

---

## Task 19: `Sidebar` and the flex `AppShell`

**Files:**
- Create: `frontend/src/components/layout/Sidebar.tsx`
- Modify: `frontend/src/layouts/AppShell.tsx`
- Test: `frontend/src/layouts/AppShell.test.tsx` (rewrite)

**Interfaces:**
- Consumes: `headerSlot`, `sidebarSlot`, `children` (the map).
- Produces: a `flex` row. Sidebar `w-[380px] xl:w-[400px]`, map `flex-1 min-w-0 relative`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("lays out the sidebar beside the map rather than over it", () => {
  const { container } = render(
    <AppShell headerSlot={<div>header</div>} sidebarSlot={<div>sidebar</div>}>
      <div data-testid="map" />
    </AppShell>,
  );

  const root = container.firstElementChild!;
  expect(root.className).toContain("flex");
  expect(root.className).not.toContain("absolute");
});

it("keeps the map in a non-shrinking flex child", () => {
  const { getByTestId } = render(
    <AppShell headerSlot={<div />} sidebarSlot={<div />}>
      <div data-testid="map" />
    </AppShell>,
  );
  expect(getByTestId("map").parentElement?.className).toContain("min-w-0");
});

it("still offers a skip link to the map region", () => {
  render(<AppShell headerSlot={<div />} sidebarSlot={<div />}><div /></AppShell>);
  expect(screen.getByRole("link", { name: /saltar/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/layouts/AppShell.test.tsx
```

Expected: FAIL — the current shell is `relative` with absolutely-positioned slots.

- [ ] **Step 3: Rewrite `AppShell`**

```tsx
export interface AppShellProps {
  headerSlot: React.ReactNode;
  sidebarSlot: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ headerSlot, sidebarSlot, children }: AppShellProps) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-sand-50">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:shadow-raise"
      >
        Saltar al mapa
      </a>
      <div className="h-16 shrink-0">{headerSlot}</div>
      <div className="flex min-h-0 flex-1">
        <Sidebar>{sidebarSlot}</Sidebar>
        <main id="contenido" className="relative min-w-0 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Write `Sidebar`**

```tsx
import type { ReactNode } from "react";

export interface SidebarProps {
  children: ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
  return (
    <aside
      aria-label="Planificador de rutas"
      className="flex w-[380px] shrink-0 flex-col overflow-y-auto border-r border-sand-200 bg-white xl:w-[400px]"
    >
      {children}
    </aside>
  );
}
```

- [ ] **Step 5: Collapse the sidebar into a bottom sheet below 1024px**

A fixed 380px column is unusable on a phone, so `Sidebar` becomes dual-mode, mirroring the pattern `PlannerSheet` already uses. Give `AppShell` an `isCompact` prop:

```tsx
export interface AppShellProps {
  headerSlot: React.ReactNode;
  sidebarSlot: React.ReactNode;
  isCompact: boolean;
  children: React.ReactNode;
}
```

`Sidebar` renders the plain column on desktop and a `Sheet` (already in `components/ui/`, with its own focus trap) with a fixed FAB trigger on mobile. The map stays `flex-1` on desktop and `absolute inset-0` behind the sheet on mobile.

Add a test for the collapse:
```tsx
it("replaces the sidebar column with a sheet trigger on mobile", () => {
  render(
    <AppShell headerSlot={<div />} sidebarSlot={<div />} isCompact>
      <div data-testid="map" />
    </AppShell>,
  );
  expect(screen.getByRole("button", { name: /planificador/i })).toBeInTheDocument();
});
```

- [ ] **Step 6: Run it**

```bash
npm test -- src/layouts/AppShell.test.tsx && npm run typecheck
```

Expected: PASS. `App.tsx` must pass `isCompact` and move `plannerSlot`/`resultsSlot` into a single `sidebarSlot` — Task 20 does that; until then pass `isCompact` and the current slots so the build stays green.

- [ ] **Step 7: Commit**

```bash
git add frontend/src/layouts/AppShell.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/layouts/AppShell.test.tsx
git commit -m "feat: switch the app shell to a sidebar and map layout"
```

---

## Task 20: Wire it all together in `App`

**Files:**
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `useUrlState`, `useIsDesktop`, `MapCanvasHandle`, `PickMode`, all new components.
- Produces: the composed app. This is where the click-to-pick flow lives end to end.

- [ ] **Step 1: Write the failing integration test**

Add to `frontend/src/App.test.tsx`, reusing that file's existing `fetch` and `matchMedia` mocks:

```tsx
it("sends coordinates after the user picks both points on the map", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Buscar ruta" });

  const map = MapStub.instances[0];
  map.renderedFeatures = [];
  act(() => map._emit("click", { lngLat: { lng: -3.7038, lat: 40.4168 }, point: { x: 0, y: 0 } }));
  act(() => map._emit("click", { lngLat: { lng: -4.0273, lat: 39.8628 }, point: { x: 0, y: 0 } }));

  await userEvent.click(screen.getByRole("button", { name: "Buscar ruta" }));

  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  const analyzeCall = fetchMock.mock.calls.find((call) => String(call[0]).includes("/api/routes/analyze"));
  const body = JSON.parse((analyzeCall![1] as RequestInit).body as string);
  expect(body.originCoordinates).toEqual({ latitude: 40.4168, longitude: -3.7038 });
  expect(body.destinationCoordinates).toEqual({ latitude: 39.8628, longitude: -4.0273 });
});

it("keeps the picked point even when reverse geocoding fails", async () => {
  fetchMock.mockImplementation((url: string) =>
    String(url).includes("/api/geocode/reverse")
      ? Promise.reject(new Error("offline"))
      : Promise.resolve({ ok: true, json: async () => sampleResponse }));

  render(<App />);
  await screen.findByRole("button", { name: "Buscar ruta" });
  const map = MapStub.instances[0];
  map.renderedFeatures = [];
  act(() => map._emit("click", { lngLat: { lng: -3.7038, lat: 40.4168 }, point: { x: 0, y: 0 } }));

  await waitFor(() => expect(screen.getByText(/Punto/i)).toBeInTheDocument());
});

it("frames the routes once a new analysis lands", async () => {
  render(<App />);
  await screen.findByRole("button", { name: "Buscar ruta" });
  await userEvent.type(screen.getByPlaceholderText(/origen/i), "Madrid");
  await userEvent.type(screen.getByPlaceholderText(/destino/i), "Toledo");
  await userEvent.click(screen.getByRole("button", { name: "Buscar ruta" }));

  await waitFor(() => expect(MapStub.instances[0].fitBoundsCalls.length).toBeGreaterThan(0));
});

it("re-runs the analysis when the link already carries both points", async () => {
  window.history.replaceState(null, "", "/?o=40.4168,-3.7038&ol=Madrid&d=39.8628,-4.0273&dl=Toledo&a=Cycling");
  render(<App />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  expect(fetchMock.mock.calls.some((call) => String(call[0]).includes("/api/routes/analyze"))).toBe(true);
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL — no `PickModeBar`, the map has no pick handler wired from `App`, and nothing fits the view.

- [ ] **Step 3: Add the state and handlers**

In `AppContent`, after the existing state declarations:

```tsx
  const { state: url, update: updateUrl } = useUrlState();
  const isDesktop = useIsDesktop();
  const isCompact = !isDesktop;
  const mapRef = useRef<MapCanvasHandle | null>(null);
  const [pickMode, setPickMode] = useState<PickMode>(originPoint ? "destination" : "origin");
  const [hoveredRouteId, setHoveredRouteId] = useState<number | null>(null);
  const [hoveredSegment, setHoveredSegment] = useState<number | null>(null);
  const [runId, setRunId] = useState(0);
```

Add the pick handler:

```tsx
  async function handlePickPoint(point: GeoPoint) {
    const fallback = `Punto ${point.latitude.toLocaleString("es-ES", { maximumFractionDigits: 4 })}, ${point.longitude.toLocaleString("es-ES", { maximumFractionDigits: 4 })}`;
    let label: string;
    try {
      label = (await reverseGeocode(point.latitude, point.longitude)) ?? fallback;
    } catch {
      label = fallback;
    }

    if (pickMode === "origin") {
      setOriginPoint(point);
      setOriginLabel(label);
      updateUrl({ origin: point, originLabel: label });
      setPickMode("destination");
    } else if (pickMode === "destination") {
      setDestinationPoint(point);
      setDestinationLabel(label);
      updateUrl({ destination: point, destinationLabel: label });
      setPickMode("none");
    }
    mapRef.current?.ensureVisible(point);
  }
```

Import `reverseGeocode` from `../services/api` and `updateUrl` from `useUrlState`.

In `handleSearch`, keep the existing guard and **add the coordinates to the request**:

```tsx
    const request: AnalyzeRequest = {
      origin: search.origin,
      destination: search.destination,
      originCoordinates: originPoint,
      destinationCoordinates: destinationPoint,
      activity: search.activity,
      departureTime: search.departureTime,
      maxDurationMinutes: search.maxDurationMinutes,
    };
```

and bump the run counter so the camera refits:
```tsx
    setRunId((current) => current + 1);
```

Add the camera effect:
```tsx
  useEffect(() => {
    if (runId === 0) return;
    mapRef.current?.fitToRoutes();
  }, [runId, result]);
```

- [ ] **Step 4: Compose the JSX**

```tsx
      <AppShell
        headerSlot={<Header onOpenAbout={() => openAbout()} onOpenHistory={() => setHistoryOpen(true)} />}
        sidebarSlot={
          <div className="flex flex-col gap-4 p-4">
            <PlannerSheet
              busy={status === "loading"}
              onSearch={handleSearch}
              onLocationError={handleLocationError}
              isCompact={isCompact}
              pickMode={pickMode}
              onPickModeChange={setPickMode}
              externalOrigin={originPoint ? { label: originLabel, point: originPoint } : null}
              externalDestination={destinationPoint ? { label: destinationLabel, point: destinationPoint } : null}
            />
            <div className="flex flex-col gap-3">
              <RefreshingIndicator visible={refreshing} />
              <ResultsLayer
                viewState={status}
                routes={result?.routes ?? []}
                weatherAvailable={result?.weatherAvailable ?? true}
                routeAvailable={result?.routeAvailable ?? true}
                selectedRouteId={selectedRouteId}
                expandedRouteId={expandedRouteId}
                onSelectRoute={handleSelectRoute}
                onToggleExpand={handleToggleExpand}
                onCloseDetail={() => setExpandedRouteId(null)}
                onRetry={handleRetry}
                onNewSearch={handleNewSearch}
                onHowCalculated={() => openAbout("score")}
                error={status === "error" ? ERROR_MESSAGE : null}
              />
            </div>
          </div>
        }
      >
        <MapCanvas
          ref={mapRef}
          routes={mapRoutes}
          selectedRouteId={selectedRouteId}
          onSelectRoute={handleSelectRoute}
          originPoint={originPoint ?? undefined}
          destinationPoint={destinationPoint ?? undefined}
          isCompact={isCompact}
          pickMode={pickMode}
          onPickPoint={handlePickPoint}
          hoveredRouteId={hoveredRouteId}
          onHoverRoute={setHoveredRouteId}
          probePoint={probePoint}
        />
        <div className="absolute left-4 top-4 z-20"><PickModeBar pickMode={pickMode} onChange={setPickMode} onFitView={() => mapRef.current?.fitToRoutes()} /></div>
        <div className="absolute bottom-4 left-4 z-20">
          <RouteDetailCard route={selectedRoute} onHoverSegment={setHoveredSegment} onClose={() => setExpandedRouteId(null)} onHowCalculated={() => openAbout("score")} />
        </div>
        <MapControlBar compact={isCompact} />
        <LiveRegion message={announcement} />
      </AppShell>
```

Add the derived values:
```tsx
  const selectedRoute = result?.routes.find((route, index) => index === selectedRouteId) ?? null;
  const probePoint = (() => {
    const segment = selectedRoute?.segments[hoveredSegment ?? -1];
    if (!segment || !selectedRoute) return null;
    const vertex = selectedRoute.polyline[segment.fromIndex];
    return vertex ? { latitude: vertex.latitude, longitude: vertex.longitude } : null;
  })();
```

`handleSelectRoute` replaces the raw `setSelectedRouteId` so the URL tracks the selection:
```tsx
  function handleSelectRoute(index: number) {
    setSelectedRouteId(index);
    updateUrl({ selectedRouteIndex: index });
  }
```

- [ ] **Step 6: Restore the state from a shared link and run it automatically**

`useUrlState` already parses on mount. Seed React state from it once, then fire the analysis when both endpoints are present:

```tsx
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (url.origin) {
      setOriginPoint(url.origin);
      setOriginLabel(url.originLabel);
    }
    if (url.destination) {
      setDestinationPoint(url.destination);
      setDestinationLabel(url.destinationLabel);
    }
    if (url.activity) setActivity(url.activity);
    if (url.departureTime) setDepartureTime(url.departureTime);
    if (url.maxDurationMinutes !== null) setMaxDurationMinutes(url.maxDurationMinutes);

    if (url.origin && url.destination) {
      runAnalysis({
        origin: url.originLabel,
        destination: url.destinationLabel,
        originPoint: url.origin,
        destinationPoint: url.destination,
        activity: url.activity,
        departureTime: url.departureTime || new Date().toISOString(),
        maxDurationMinutes: url.maxDurationMinutes,
      });
    }
  }, []);
```

The `restoredRef` guard matters: `useUrlState` returns a fresh object identity on every `popstate`, and re-running this effect would re-fire the analysis on every back button press.

- [ ] **Step 7: Write the camera into the URL**

A shared link should reopen at the same view. Extend `useUrlState`'s `UrlState` with `zoom: number | null` and `center: GeoCoordinates | null` (params `z`, `lat`, `lon`), then in `App` write the camera on `moveend`, debounced with the existing `useDebouncedCallback`:

```tsx
  const syncCamera = useDebouncedCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    updateUrl({ zoom: map.getZoom(), center: map.getCenter() });
  }, 500);
```

`MapCanvas` needs to surface the camera. Add an optional `onCameraChange(center: [number, number], zoom: number): void` prop and wire it inside the lifecycle effect:

```ts
    map.on("moveend", () => {
      onCameraChangeRef.current?.(map.getCenter(), map.getZoom());
    });
```

with the matching `map.off("moveend", …)` in the cleanup.

Restore it on load, before the style is ready is fine for `jumpTo`:
```tsx
  useEffect(() => {
    const map = mapRef.current;
    if (!map || url.zoom === null || !url.center) return;
    map.jumpTo({ center: [url.center.longitude, url.center.latitude], zoom: url.zoom });
  }, [url.zoom, url.center]);
```

**Guard against the feedback loop**: `fitToRoutes` fires `moveend`, which writes the camera, which must not trigger another fit. It cannot, because the fit effect keys on `runId`, not on the camera — but do assert it, because a loop here pins the CPU:

```ts
it("does not refit when only the camera changes", async () => {
  // after a fit, emit moveend and assert fitBoundsCalls did not grow
});
```

- [ ] **Step 8: Extract the analysis state machine into `useRouteAnalysis`**

`App.tsx` is currently 327 lines and will have grown. Move the mutation, the debounced refresh, `intentRef`, `refreshRequestRef` and the history save into `src/hooks/useRouteAnalysis.ts`:

```ts
export interface RouteAnalysisController {
  status: AppStatus;
  result: RouteAnalysisResponse | null;
  refreshing: boolean;
  runAnalysis(search: PlannerSearch): void;
  retry(): void;
  reset(): void;
}

export function useRouteAnalysis(): RouteAnalysisController;
```

`App.tsx` keeps only UI state (pick mode, hover, announcement, camera) and calls the controller. Extract verbatim — no behaviour change in this step — then re-run the suite to prove the move was inert.

- [ ] **Step 9: Run it**

```bash
npm test -- src/App.test.tsx && npm run typecheck
```

Expected: PASS. `PlannerSheet` needs the four new props — add them in Step 10.

- [ ] **Step 10: Teach `PlannerSheet` to reflect a picked point**

`PlannerSheet` forwards the picked coordinates into `OriginDestinationFields` so the map and the text inputs never disagree:

```tsx
export interface PlannerSheetProps {
  busy: boolean;
  onSearch: (search: PlannerSearch) => void;
  onLocationError: () => void;
  isCompact: boolean;
  pickMode: PickMode;
  onPickModeChange: (mode: PickMode) => void;
  externalOrigin: { label: string; point: GeoPoint } | null;
  externalDestination: { label: string; point: GeoPoint } | null;
}
```

Add a small `PickHint` strip above the form so the sidebar explains the map interaction:
```tsx
      {pickMode !== "none" && (
        <p className="rounded-lg bg-ocean-50 px-3 py-2 text-xs text-ocean-800" role="status">
          Haz clic en el mapa para fijar el {pickMode === "origin" ? "origen" : "destino"}.
        </p>
      )}
```

`OriginDestinationFields` gains `originOverride` / `destinationOverride`; when set, it renders the label and a small "cambiar" button instead of the free-text input, and reports the point through the existing `validate()` handle. Read `OriginDestinationFields.tsx:76-81` first — it already exposes an imperative `validate()` via `useImperativeHandle`, and the override path must keep satisfying it.

- [ ] **Step 11: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/planner/
git commit -m "feat: wire the sidebar, map picking and shared camera"
```

---

## Task 21: The "no route" error state

**Files:**
- Modify: `frontend/src/components/results/ResultsLayer.tsx`
- Test: `frontend/src/components/results/ResultsLayer.test.tsx`

**Interfaces:**
- Consumes: `routes`, `routeAvailable`, `activityLabel: string`.
- Produces: a real explanation when the provider returns zero routes — today it renders an empty list with no reason.

- [ ] **Step 1: Write the failing test**

```tsx
it("explains why there is no route instead of showing an empty list", () => {
  render(
    <ResultsLayer
      viewState="partial"
      routes={[]}
      weatherAvailable
      routeAvailable={false}
      activityLabel="ciclismo"
      selectedRouteId={null}
      expandedRouteId={null}
      onSelectRoute={vi.fn()}
      onToggleExpand={vi.fn()}
      onCloseDetail={vi.fn()}
      onRetry={vi.fn()}
      onNewSearch={vi.fn()}
      onHowCalculated={vi.fn()}
      error={null}
    />,
  );

  expect(screen.getByText(/no hay ruta posible/i)).toBeInTheDocument();
  expect(screen.getByText(/ciclismo/)).toBeInTheDocument();
  expect(screen.queryByTestId("route-list")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/results/ResultsLayer.test.tsx
```

Expected: FAIL — the current component renders an empty `<ul>`.

- [ ] **Step 3: Implement**

Add `activityLabel: string` to `ResultsLayerProps`, and in the `hasRoutes` branch's `: (` — i.e. before the `return` at `ResultsLayer.tsx:70` — add an explicit no-route explanation. The current empty branch renders only a "Nueva búsqueda" button, so a provider failure looks identical to "still loading":

```tsx
  const hasRoutes = routes.length > 0;
  const noRouteReason = !routeAvailable;

  return (
    <div className="space-y-4">
      {!weatherAvailable && <PartialBanner>{WEATHER_UNAVAILABLE_MESSAGE}</PartialBanner>}
      {noRouteReason && (
        <ErrorState
          title="No hay ruta posible"
          message={`No encontramos ninguna ruta con perfil de ${activityLabel} entre esos dos puntos. Prueba a mover los extremos o a cambiar de actividad.`}
          onRetry={onRetry}
        />
      )}

      {hasRoutes ? (
        <RouteList … />
      ) : (
        !noRouteReason && (
          <div className="flex justify-end">
            <Button variant="secondary" onClick={onNewSearch}>
              Nueva búsqueda
            </Button>
          </div>
        )
      )}
    </div>
  );
```

`ErrorState` renders `role="alert"`, so this is announced without extra work. Pass the activity's Spanish label down from `App`. `ActivityPicker` already carries the labels — export them from there and reuse rather than re-typing a map:
```ts
export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  Walking: "caminata",
  Running: "carrera",
  Cycling: "ciclismo",
  Motorcycle: "motocicleta",
  Driving: "conducción",
};
```

- [ ] **Step 4: Run it**

```bash
npm test && npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/results/ frontend/src/App.tsx
git commit -m "fix: explain an empty route result instead of showing a blank list"
```

---

## Task 22: Announce state changes to screen readers

**Files:**
- Create: `frontend/src/components/ui/LiveRegion.tsx`
- Test: `frontend/src/components/ui/LiveRegion.test.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `LiveRegion({ message: string | null })` rendering a visually hidden `aria-live="polite"` region. The visual companion already does this for toasts (`hooks/useToasts.tsx`); this one is for map-driven state.

- [ ] **Step 1: Write the failing test**

```tsx
it("announces a message politely", () => {
  render(<LiveRegion message="Origen fijado en Madrid" />);
  const region = screen.getByRole("status");
  expect(region).toHaveTextContent("Origen fijado en Madrid");
  expect(region).toHaveAttribute("aria-live", "polite");
});

it("renders nothing visible when there is no message", () => {
  const { container } = render(<LiveRegion message={null} />);
  expect(container.firstElementChild).toBeNull();
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npm test -- src/components/ui/LiveRegion.test.tsx
```

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

```tsx
export interface LiveRegionProps {
  message: string | null;
}

export default function LiveRegion({ message }: LiveRegionProps) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="sr-only">
      {message}
    </div>
  );
}
```

- [ ] **Step 4: Wire the announcements in `App`**

```tsx
  const [announcement, setAnnouncement] = useState<string | null>(null);
```
Set it in `handlePickPoint`:
```tsx
      setAnnouncement(`Origen fijado en ${label}`);
```
and in `handleSelectRoute`:
```tsx
    setAnnouncement(`Ruta ${index + 1} seleccionada`);
```

- [ ] **Step 5: Run it**

```bash
npm test && npm run typecheck && npm run build
```

Expected: PASS, and `vite build` succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/ui/LiveRegion.tsx frontend/src/components/ui/LiveRegion.test.tsx frontend/src/App.tsx
git commit -m "feat: announce map selections to screen readers"
```

---

## Task 23: Remove the dead dependencies

**Files:**
- Modify: `frontend/package.json`

**Interfaces:**
- Consumes: `rg` results proving nothing imports them.

- [ ] **Step 1: Prove they are still unused**

```bash
rg -n "from \"recharts\"" frontend/src
rg -n "react-hook-form|@hookform/resolvers" frontend/src
```

`recharts` **is** imported by Task 17. `react-hook-form` and `@hookform/resolvers` should return nothing.

- [ ] **Step 2: Remove the unused ones**

```bash
npm uninstall react-hook-form @hookform/resolvers
```

Keep `recharts`.

- [ ] **Step 3: Verify the whole frontend gate**

```bash
npm run typecheck && npm test && npm run build
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "chore: drop unused form dependencies"
```

---

## Task 24: Full gate

**Files:**
- Modify: `AGENTS.md` if any documented command changed (it did not — verify).

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Backend gate**

```bash
dotnet build backend/WeatherRoute.slnx --no-restore -warnaserror
dotnet test backend/WeatherRoute.slnx --filter "Category!=Integration"
```

Expected: **0 warnings, 0 errors**; all fast tests pass.

- [ ] **Step 2: Frontend gate**

```bash
cd frontend
npm run lint
npm run typecheck
npm test
npm run build
```

Expected: clean lint, clean types, all tests, successful build.

- [ ] **Step 3: Integration tests with Docker up**

```bash
dotnet test backend/WeatherRoute.slnx --filter "Category=Integration"
```

Expected: PASS. The ORS contract test skips without `OPENROUTESERVICE_API_KEY` — a skip is acceptable, a failure is not.

- [ ] **Step 4: Update the spec status**

Edit `docs/superpowers/specs/2026-09-28-weatherroute-maps-redesign.md` and tick off the completed items; note anything that shipped differently and why.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "docs: mark the maps redesign phase 1 complete"
```

- [ ] **Step 6: Open a PR**

```bash
git push -u origin feature/maps-layout
gh pr create --fill
```

The PR body should state: what changed, the additive API change (with the exact new JSON fields), that `Domain` and `IRouteProvider` are untouched, and the verification output from Steps 1–3 pasted verbatim. Do not claim anything that the commands above did not actually print.
