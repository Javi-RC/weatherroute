# WeatherRoute Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build WeatherRoute, a weather-aware route planner with a hexagonally-architected .NET 10 backend and a React frontend that answers "which route and departure time have the best conditions for this activity?"

**Architecture:** Hexagonal. `WeatherRoute.Domain` (no external deps) holds entities/value objects and a per-activity risk engine (Strategy pattern). `WeatherRoute.Application` contains `CalculateRouteUseCase` orchestrating geocoding → routing → route sampling → weather per point → risk → recommendation, talking only to output ports (`IGeocodingProvider`, `IRouteProvider`, `IWeatherProvider`, `IAnalysisRepository`). `WeatherRoute.Infrastructure` implements adapters (OpenRouteService, Open-Meteo, EF Core + PostgreSQL, Redis cache, resilience). `WeatherRoute.Api` exposes REST + health + OpenTelemetry. Frontend: Vite + React + Tailwind + React Query + MapLibre.

**Tech Stack:** .NET 10, ASP.NET Core, EF Core + Npgsql, Microsoft.Extensions.Http.Resilience, OpenTelemetry, xUnit, FluentValidation, Microsoft.Extensions.Caching.StackExchangeRedis, Docker Compose; React 19, TypeScript, Vite, Tailwind CSS 4, @tanstack/react-query, react-hook-form, zod, maplibre-gl, recharts, Vitest, Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-21-weatherroute-design.md`

## Global Constraints

- .NET 10 SDK, nullable enabled, `ImplicitUsings` enabled, `TreatWarningsAsErrors` true.
- Namespaces: `WeatherRoute.Domain`, `WeatherRoute.Application`, `WeatherRoute.Infrastructure`, `WeatherRoute.Api`. Tests under `WeatherRoute.*.Tests`.
- Dependency rule: Domain → (nothing external). Application → Domain only. Infrastructure → Application + Domain. Api → all.
- No authentication, no user entities. Anonymous analyses only.
- Provider details (URLs, API keys) always via `IConfiguration`; never hardcoded or committed.
- ORS deliverable: geocoding `GET /v2/geocode/search?text=`; routing `POST /v2/directions/{profile}` with header `Authorization: <key>`. Profile map: Cycling→`cycling-regular`, Walking→`foot-walking`, Running→`foot-walking`, Motorcycle→`driving-motorcycle`, Driving→`driving-car`. Geometries are `[lon, lat]` arrays.
- Open-Meteo: no key, `timezone=UTC`, hourly: `temperature_2m,wind_speed_10m,precipitation_probability,uv_index,visibility,relative_humidity_2m,weather_code`.
- Sampling: one point every ~10 km, max 20 points. Speeds (km/h): Walking 5, Running 10, Cycling 20, Motorcycle 60, Driving 60.
- Cache key: `route-analysis:{sha256(origin|dest|activity|departureUtc:o)}`; TTL = max(60s, min(6h, forecastStart - now)). Fallback to in-memory if Redis unavailable.
- Risk: `score = clamp(100 - penalties, 0, 100)`; levels `0–25 Severe`, `26–50 High`, `51–75 Moderate`, `76–100 Low`.
- REST responses: `status: "full"|"partial"` + `weatherAvailable`/`routeAvailable`. Never a bare 500 on provider failures.
- Commit after every green step: `feat:`, `test:`, `chore:`.
- Frontend single-page; dev proxies `/api` to `http://localhost:5080`.

---

### Task 1: Scaffold solution, projects and test runner

**Files:**
- Create: `backend/WeatherRoute.sln`, `backend/Directory.Build.props`
- Create: `backend/WeatherRoute.Domain/WeatherRoute.Domain.csproj`
- Create: `backend/WeatherRoute.Application/WeatherRoute.Application.csproj`
- Create: `backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj`
- Create: `backend/WeatherRoute.Api/WeatherRoute.Api.csproj` + `Program.cs`
- Create: `tests/WeatherRoute.Domain.Tests/` + `tests/WeatherRoute.Application.Tests/` + `tests/WeatherRoute.Infrastructure.Tests/` (csproj + smoke test + `GlobalUsings.cs`)

**Interfaces:**
- Produces: solution with correct project references, `dotnet test` green.

- [ ] **Step 1: Create `backend/Directory.Build.props`**

```xml
<Project>
  <PropertyGroup>
    <TargetFramework>net10.0</TargetFramework>
    <ImplicitUsings>enable</ImplicitUsings>
    <Nullable>enable</Nullable>
    <TreatWarningsAsErrors>true</TreatWarningsAsErrors>
  </PropertyGroup>
</Project>
```

- [ ] **Step 2: Create the four backend csproj files**

`backend/WeatherRoute.Domain/WeatherRoute.Domain.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk" />
```

`backend/WeatherRoute.Application/WeatherRoute.Application.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\WeatherRoute.Domain\WeatherRoute.Domain.csproj" />
  </ItemGroup>
</Project>
```

`backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <ProjectReference Include="..\WeatherRoute.Application\WeatherRoute.Application.csproj" />
    <ProjectReference Include="..\WeatherRoute.Domain\WeatherRoute.Domain.csproj" />
  </ItemGroup>
</Project>
```

`backend/WeatherRoute.Api/WeatherRoute.Api.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk.Web">
  <ItemGroup>
    <ProjectReference Include="..\WeatherRoute.Infrastructure\WeatherRoute.Infrastructure.csproj" />
    <ProjectReference Include="..\WeatherRoute.Application\WeatherRoute.Application.csproj" />
    <ProjectReference Include="..\WeatherRoute.Domain\WeatherRoute.Domain.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 3: Create the three test csproj files**

Template (repeated; only the ProjectReference layer path changes):

`tests/WeatherRoute.Domain.Tests/WeatherRoute.Domain.Tests.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.*" />
    <PackageReference Include="xunit" Version="2.9.*" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.*" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\backend\WeatherRoute.Domain\WeatherRoute.Domain.csproj" />
  </ItemGroup>
</Project>
```

Same shape for `Application.Tests` (refers to `..\..\backend\WeatherRoute.Application`) and `Infrastructure.Tests` (refers to `..\..\backend\WeatherRoute.Infrastructure`).

Corrected C# note: `dotnet new` is not needed; create the files directly. Keep `Step 1–3` as pure file creation.

- [ ] **Step 4: Write smoke test**

`tests/WeatherRoute.Domain.Tests/SmokeTests.cs`:
```csharp
namespace WeatherRoute.Domain.Tests;

public class SmokeTests
{
    [Fact]
    public void Domain_Assembly_Resolves()
    {
        Assert.Equal("WeatherRoute.Domain",
            typeof(WeatherRoute.Domain.ValueObjects.Coordinates).Assembly.GetName().Name);
    }
}
```

`tests/WeatherRoute.Domain.Tests/GlobalUsings.cs`:
```csharp
global using Xunit;
```

Add the same `GlobalUsings.cs` to `Application.Tests` and `Infrastructure.Tests` (explicit `using Xunit;` in file is enough).

- [ ] **Step 5: Create solution and add projects**

```bash
dotnet new sln -n WeatherRoute -o backend
dotnet sln backend/WeatherRoute.sln add backend/WeatherRoute.Domain backend/WeatherRoute.Application backend/WeatherRoute.Infrastructure backend/WeatherRoute.Api
dotnet sln backend/WeatherRoute.sln add tests/WeatherRoute.Domain.Tests tests/WeatherRoute.Application.Tests tests/WeatherRoute.Infrastructure.Tests
```

This depends on `Coordinates` from Task 2, so temporarily point the smoke test at `typeof(WeatherRoute.Domain.Enums.ActivityType)` which is also Task 2. If the smoke test does not compile yet, mark the assembly assertion as pending and instead:

```csharp
[Fact]
public void Runner_Works()
{
    Assert.True(true);
}
```

and strengthen it in Task 2's final commit. (Every task must compile; the placeholder is temporary and replaced by EOT of Task 2.)

- [ ] **Step 6: Add minimal Api Program.cs**

`backend/WeatherRoute.Api/Program.cs`:
```csharp
var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/", () => "WeatherRoute API");
app.Run();

public partial class Program;
```

- [ ] **Step 7: Run tests to verify green**

Run: `dotnet test backend/WeatherRoute.sln`
Expected: all projects build, tests pass.

- [ ] **Step 8: Commit**

```bash
git add backend tests
git commit -m "feat: scaffold hexagonal solution with test projects"
```

---

### Task 2: Domain value objects and enums

**Files:**
- Create: `backend/WeatherRoute.Domain/Enums/ActivityType.cs`, `Enums/RiskLevel.cs`, `Enums/WeatherCondition.cs`
- Create: `backend/WeatherRoute.Domain/ValueObjects/Coordinates.cs`, `ValueObjects/Distance.cs`, `ValueObjects/Duration.cs`, `ValueObjects/Wind.cs`, `ValueObjects/Temperature.cs`
- Test: `tests/WeatherRoute.Domain.Tests/ValueObjectsTests.cs`

**Interfaces:**
- Produces: `record Coordinates(double Latitude, double Longitude)` with `double DistanceKmTo(Coordinates)`; `record Distance(double Km)` with `static Distance Zero`; `record Duration(TimeSpan Value)` with `int TotalMinutesCeiled`; `record Wind(double Kmh)`; `record Temperature(double Celsius)`; enums `ActivityType`, `RiskLevel`, `WeatherCondition`. Throw `ArgumentOutOfRangeException` on invalid values.

- [ ] **Step 1: Write failing tests**

`tests/WeatherRoute.Domain.Tests/ValueObjectsTests.cs`:
```csharp
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class ValueObjectsTests
{
    [Fact]
    public void Coordinates_Haversine_Zero_Distance()
    {
        var a = new Coordinates(38.98, -3.92);
        Assert.Equal(0, a.DistanceKmTo(a), 5);
    }

    [Fact]
    public void Coordinates_Distance_Montmelo()
    {
        var ciu = new Coordinates(38.986, -3.929);
        var alm = new Coordinates(38.888, -3.712);
        var km = ciu.DistanceKmTo(alm);
        Assert.InRange(km, 15, 25);
    }

    [Fact]
    public void Coordinates_Invalid_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Coordinates(91, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Coordinates(0, -181));
    }

    [Fact]
    public void Distance_Invalid_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Distance(-1));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Duration(TimeSpan.FromMinutes(-1)));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Wind(-2));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Temperature(100));
    }

    [Fact]
    public void Records_Compare_By_Value()
    {
        Assert.Equal(new Coordinates(1, 2), new Coordinates(1, 2));
        Assert.Equal(new Distance(5), new Distance(5));
        Assert.True(new Wind(20).Kmh > new Wind(12).Kmh);
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/WeatherRoute.Domain.Tests --no-restore`
Expected: FAIL (types missing).

- [ ] **Step 3: Implement enums**

```csharp
// Enums/ActivityType.cs
namespace WeatherRoute.Domain.Enums;

public enum ActivityType
{
    Walking,
    Running,
    Cycling,
    Motorcycle,
    Driving
}
```

```csharp
// Enums/RiskLevel.cs
namespace WeatherRoute.Domain.Enums;

public enum RiskLevel { Low, Moderate, High, Severe }
```

```csharp
// Enums/WeatherCondition.cs
namespace WeatherRoute.Domain.Enums;

public enum WeatherCondition { Clear, Clouds, Fog, Rain, Snow, Storm, Unknown }
```

- [ ] **Step 4: Implement value objects**

```csharp
// ValueObjects/Coordinates.cs
namespace WeatherRoute.Domain.ValueObjects;

public sealed record Coordinates
{
    public Coordinates(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90)
            throw new ArgumentOutOfRangeException(nameof(latitude), "Latitude must be in [-90, 90].");
        if (longitude is < -180 or > 180)
            throw new ArgumentOutOfRangeException(nameof(longitude), "Longitude must be in [-180, 180].");
        Latitude = latitude;
        Longitude = longitude;
    }

    public double Latitude { get; }
    public double Longitude { get; }

    public double DistanceKmTo(Coordinates other)
    {
        const double r = 6371.0088;
        double dLat = Deg2Rad(other.Latitude - Latitude);
        double dLon = Deg2Rad(other.Longitude - Longitude);
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                 + Math.Cos(Deg2Rad(Latitude)) * Math.Cos(Deg2Rad(other.Latitude))
                 * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * r * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static double Deg2Rad(double deg) => deg * Math.PI / 180;
}
```

```csharp
// ValueObjects/Distance.cs
namespace WeatherRoute.Domain.ValueObjects;

public sealed record Distance
{
    public Distance(double km)
    {
        if (km < 0) throw new ArgumentOutOfRangeException(nameof(km), "Distance must be >= 0.");
        Km = km;
    }

    public double Km { get; }
    public static Distance Zero => new(0);
}
```

```csharp
// ValueObjects/Duration.cs
namespace WeatherRoute.Domain.ValueObjects;

public sealed record Duration
{
    public Duration(TimeSpan value)
    {
        if (value < TimeSpan.Zero) throw new ArgumentOutOfRangeException(nameof(value));
        Value = value;
    }

    public TimeSpan Value { get; }
    public int TotalMinutesCeiled => (int)Math.Ceiling(Value.TotalMinutes);
}
```

```csharp
// ValueObjects/Wind.cs
namespace WeatherRoute.Domain.ValueObjects;

public sealed record Wind
{
    public Wind(double kmh)
    {
        if (kmh < 0) throw new ArgumentOutOfRangeException(nameof(kmh), "Wind must be >= 0.");
        Kmh = kmh;
    }

    public double Kmh { get; }
}
```

```csharp
// ValueObjects/Temperature.cs
namespace WeatherRoute.Domain.ValueObjects;

public sealed record Temperature
{
    public Temperature(double celsius)
    {
        if (celsius is < -90 or > 60) throw new ArgumentOutOfRangeException(nameof(celsius));
        Celsius = celsius;
    }

    public double Celsius { get; }
}
```

- [ ] **Step 5: Strengthen smoke test and verify green**

Update `SmokeTests.cs` to the `Domain_Assembly_Resolves` version referencing `Coordinates`. Run:

Run: `dotnet test tests/WeatherRoute.Domain.Tests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend tests
git commit -m "feat: domain value objects and enums with validation"
```

---

### Task 3: Domain entities — Route, RouteSegment, WeatherSnapshot

**Files:**
- Create: `backend/WeatherRoute.Domain/Entities/WeatherSnapshot.cs`, `Entities/RouteSegment.cs`, `Entities/Route.cs`
- Test: `tests/WeatherRoute.Domain.Tests/EntitiesTests.cs`

**Interfaces:**
- Consumes: `Coordinates`, `Distance`, `Wind`, `Temperature`, enums (Task 2).
- Produces:
  - `WeatherSnapshot(Temperature? Temperature, Wind? Wind, double? PrecipitationProbability, int? UvIndex, double? VisibilityKm, WeatherCondition Condition)`
  - `RouteSegment(Coordinates Start, Coordinates End, Distance Distance, TimeSpan EstimatedDuration, int StartPointIndex, int EndPointIndex)` with `void AssignWeather(WeatherSnapshot)`, `void SetArrival(TimeSpan)`, `WeatherSnapshot? Weather`, `TimeSpan? ArrivalTime`, `bool HasWeather`
  - `Route(ActivityType Activity, IReadOnlyList<RouteSegment> Segments, IReadOnlyList<Coordinates> Geometry)` with `Distance TotalDistance`, `TimeSpan TotalDuration`

- [ ] **Step 1: Write failing tests**

`tests/WeatherRoute.Domain.Tests/EntitiesTests.cs`:
```csharp
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class EntitiesTests
{
    [Fact]
    public void Segment_Can_AssignWeather()
    {
        var seg = new RouteSegment(new Coordinates(38.98, -3.92), new Coordinates(39.0, -3.90),
            new Distance(12), TimeSpan.FromMinutes(36), 0, 3);

        Assert.False(seg.HasWeather);
        var snap = new WeatherSnapshot(new Temperature(18), new Wind(8), 10, 3, 10, WeatherCondition.Clear);
        seg.AssignWeather(snap);
        seg.SetArrival(TimeSpan.FromMinutes(36));

        Assert.True(seg.HasWeather);
        Assert.Equal(18, seg.Weather!.Temperature!.Celsius);
        Assert.Equal(WeatherCondition.Clear, seg.Weather.Condition);
        Assert.Equal(TimeSpan.FromMinutes(36), seg.ArrivalTime);
    }

    [Fact]
    public void Route_Totals()
    {
        var seg1 = new RouteSegment(new Coordinates(0, 0), new Coordinates(0, 1), new Distance(10), TimeSpan.FromMinutes(30), 0, 1);
        var seg2 = new RouteSegment(new Coordinates(0, 1), new Coordinates(0, 2), new Distance(20), TimeSpan.FromMinutes(60), 1, 2);
        var route = new Route(ActivityType.Cycling,
            new[] { seg1, seg2 },
            new[] { new Coordinates(0, 0), new Coordinates(0, 1), new Coordinates(0, 2) });

        Assert.Equal(30, route.TotalDistance.Km);
        Assert.Equal(TimeSpan.FromMinutes(90), route.TotalDuration);
        Assert.Equal(3, route.Geometry.Count);
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `dotnet test tests/WeatherRoute.Domain.Tests --no-restore`
Expected: FAIL.

- [ ] **Step 3: Implement entities**

```csharp
// Entities/WeatherSnapshot.cs
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Entities;

public sealed record WeatherSnapshot(
    Temperature? Temperature,
    Wind? Wind,
    double? PrecipitationProbability,
    int? UvIndex,
    double? VisibilityKm,
    WeatherCondition Condition);
```

```csharp
// Entities/RouteSegment.cs
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Entities;

public sealed class RouteSegment
{
    public RouteSegment(Coordinates start, Coordinates end, Distance distance,
        TimeSpan estimatedDuration, int startPointIndex, int endPointIndex)
    {
        Start = start;
        End = end;
        Distance = distance;
        EstimatedDuration = estimatedDuration;
        StartPointIndex = startPointIndex;
        EndPointIndex = endPointIndex;
    }

    public Coordinates Start { get; }
    public Coordinates End { get; }
    public Distance Distance { get; }
    public TimeSpan EstimatedDuration { get; }
    public int StartPointIndex { get; }
    public int EndPointIndex { get; }
    public WeatherSnapshot? Weather { get; private set; }
    public TimeSpan? ArrivalTime { get; private set; }
    public bool HasWeather => Weather is not null;

    public void AssignWeather(WeatherSnapshot weather) => Weather = weather;
    public void SetArrival(TimeSpan arrival) => ArrivalTime = arrival;
}
```

```csharp
// Entities/Route.cs
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Entities;

public sealed class Route
{
    public Route(ActivityType activity, IReadOnlyList<RouteSegment> segments, IReadOnlyList<Coordinates> geometry)
    {
        Activity = activity;
        Segments = segments;
        Geometry = geometry;
    }

    public ActivityType Activity { get; }
    public IReadOnlyList<RouteSegment> Segments { get; }
    public IReadOnlyList<Coordinates> Geometry { get; }
    public Distance TotalDistance => new(Segments.Sum(s => s.Distance.Km));
    public TimeSpan TotalDuration => Segments.Aggregate(TimeSpan.Zero, (acc, s) => acc + s.EstimatedDuration);
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `dotnet test tests/WeatherRoute.Domain.Tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend tests
git commit -m "feat: domain entities Route, RouteSegment, WeatherSnapshot"
```

---
### Task 4: Application output ports and DTOs

**Files:**
- Create: `backend/WeatherRoute.Application/Ports/Out/IGeocodingProvider.cs`, `Ports/Out/IRouteProvider.cs`, `Ports/Out/IWeatherProvider.cs`, `Ports/Out/IAnalysisRepository.cs`
- Create: `backend/WeatherRoute.Application/Dtos/ExternalRoute.cs`, `Dtos/ExternalWeather.cs`, `Dtos/RouteAnalysisRecord.cs`
- Test: none (compile-check via `dotnet build`)

**Interfaces:**
- Produces:
  - `IGeocodingProvider.GeocodeAsync(string query, CancellationToken)`
  - `IRouteProvider.CalculateRoutesAsync(Coordinates origin, Coordinates destination, ActivityType activity, int alternativeCount, CancellationToken)`
  - `IWeatherProvider.GetForecastAsync(Coordinates coordinates, DateTime timestampUtc, CancellationToken)` → `ExternalWeather?` (null = fuera de rango)
  - `IAnalysisRepository.SaveAsync(RouteAnalysisRecord record, CancellationToken)`
  - DTO records below (all sealed records, public properties).

- [ ] **Step 1: Write the four port interfaces**

```csharp
// Ports/Out/IGeocodingProvider.cs
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Ports.Out;

public interface IGeocodingProvider
{
    Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default);
}
```

```csharp
// Ports/Out/IRouteProvider.cs
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IRouteProvider
{
    Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(
        Coordinates origin,
        Coordinates destination,
        ActivityType activity,
        int alternativeCount,
        CancellationToken ct = default);
}
```

```csharp
// Ports/Out/IWeatherProvider.cs
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IWeatherProvider
{
    Task<ExternalWeather?> GetForecastAsync(
        Coordinates coordinates,
        DateTime timestampUtc,
        CancellationToken ct = default);
}
```

```csharp
// Ports/Out/IAnalysisRepository.cs
using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IAnalysisRepository
{
    Task<Guid> SaveAsync(RouteAnalysisRecord record, CancellationToken ct = default);
}
```

- [ ] **Step 2: Write the DTO records**

```csharp
// Dtos/ExternalRoute.cs
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Dtos;

public sealed record ExternalRoute(
    string ProviderId,
    double DistanceKm,
    TimeSpan Duration,
    IReadOnlyList<Coordinates> Geometry);
```

```csharp
// Dtos/ExternalWeather.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Dtos;

public sealed record ExternalWeather(
    double? TemperatureC,
    double? WindKmh,
    double? PrecipitationProbability,
    int? UvIndex,
    double? VisibilityKm,
    WeatherCondition Condition);
```

```csharp
// Dtos/RouteAnalysisRecord.cs
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Dtos;

public sealed record RouteAnalysisRecord(
    Guid Id,
    string Origin,
    string Destination,
    Coordinates OriginCoordinates,
    Coordinates DestinationCoordinates,
    ActivityType Activity,
    DateTime DepartureUtc,
    double DistanceKm,
    int DurationMinutes,
    int RiskScore,
    RiskLevel RiskLevel,
    DateTime CreatedAtUtc);
```

- [ ] **Step 3: Verify build**

Run: `dotnet build backend/WeatherRoute.sln`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add backend
git commit -m "feat: application output ports and DTOs"
```

---

### Task 5: OpenRouteService adapter (geocoding + routing)

**Files:**
- Create: `backend/WeatherRoute.Infrastructure/Routing/OpenRouteServiceOptions.cs`, `Routing/OrsProfiles.cs`, `Routing/GeocodingException.cs`, `Routing/OpenRouteServiceRoutingAdapter.cs`, `Routing/OrsJson.cs` (all JsonElement helpers in the adapter file)
- Test: `tests/WeatherRoute.Infrastructure.Tests/OpenRouteServiceRoutingAdapterTests.cs`, `StubHandler.cs`

**Interfaces:**
- Consumes: `IGeocodingProvider`, `IRouteProvider`, `ExternalRoute` (Task 4).
- Produces: `OpenRouteServiceRoutingAdapter : IGeocodingProvider, IRouteProvider` with ctor `(HttpClient http, OpenRouteServiceOptions options)`.

- [ ] **Step 1: Write stub handler + failing tests**

`tests/WeatherRoute.Infrastructure.Tests/StubHandler.cs`:
```csharp
using System.Net;
using System.Text;

namespace WeatherRoute.Infrastructure.Tests;

public sealed class StubHandler : HttpMessageHandler
{
    private readonly Func<HttpRequestMessage, string> _responder;

    public StubHandler(Func<HttpRequestMessage, string> responder) => _responder = responder;

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken ct)
    {
        var body = _responder(request);
        var response = new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json")
        };
        return Task.FromResult(response);
    }
}
```

`tests/WeatherRoute.Infrastructure.Tests/OpenRouteServiceRoutingAdapterTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Headers;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Routing;

namespace WeatherRoute.Infrastructure.Tests;

public class OpenRouteServiceRoutingAdapterTests
{
    private static OpenRouteServiceRoutingAdapter Build(Func<HttpRequestMessage, string> responder) =>
        new(new HttpClient(new StubHandler(responder))
        {
            BaseAddress = new Uri("https://api.openrouteservice.org")
        }, new OpenRouteServiceOptions { ApiKey = "secret-key" });

    [Fact]
    public async Task Geocodes_First_Feature()
    {
        var adapter = Build(req =>
        {
            Assert.StartsWith("/v2/geocode/search?text=", req.RequestUri!.PathAndQuery);
            Assert.Equal("secret-key", req.Headers.GetValues("Authorization").Single());
            return """
            {"features":[{"geometry":{"type":"Point","coordinates":[-3.929,38.986]}}]}
            """;
        });

        var result = await ((IGeocodingProvider)adapter).GeocodeAsync("Ciudad Real");

        Assert.Equal(38.986, result.Latitude, 3);
        Assert.Equal(-3.929, result.Longitude, 3);
    }

    [Fact]
    public async Task Geocode_Empty_Throws()
    {
        var adapter = Build(_ => """{"features":[]}""");
        await Assert.ThrowsAsync<GeocodingException>(() =>
            ((IGeocodingProvider)adapter).GeocodeAsync("Nada por aqui"));
    }

    [Fact]
    public async Task Routing_Uses_Per_Activity_Profile_And_Returns_Route()
    {
        var adapter = Build(req =>
        {
            Assert.EndsWith("cycling-regular", req.RequestUri!.PathAndQuery);
            using var body = JsonDocument.ParseAsync(req.Content!.ReadAsStreamAsync().Result)
                .ConfigureAwait(false).GetAwaiter().GetResult();
            Assert.True(body.RootElement.TryGetProperty("alternative_routes", out _));
            return """
            {"routes":[
              {
                "summary":{"distance":74200,"duration":10080},
                "geometry":{"type":"LineString","coordinates":[[-3.929,38.986],[-3.912,38.97]]}
              }
            ]}
            """;
        });

        var routes = await ((IRouteProvider)adapter).CalculateRoutesAsync(
            new Coordinates(38.986, -3.929),
            new Coordinates(38.97, -3.912),
            ActivityType.Cycling,
            alternativeCount: 2);

        var route = Assert.Single(routes);
        Assert.Equal(74.2, route.DistanceKm, 1);
        Assert.Equal(TimeSpan.FromHours(2.8), route.Duration, TimeSpan.FromSeconds(1));
        Assert.Equal(2, route.Geometry.Count);
        Assert.Equal(38.986, route.Geometry[0].Latitude, 3);
    }

    [Fact]
    public async Task Routing_Api_Errors_Propagate()
    {
        var client = new HttpClient(new StubHandler(_ => throw new HttpRequestException("boom")))
        {
            BaseAddress = new Uri("https://api.openrouteservice.org")
        };
        var adapter = new OpenRouteServiceRoutingAdapter(client, new OpenRouteServiceOptions { ApiKey = "k" });
        _ = await Assert.ThrowsAsync<HttpRequestException>(() =>
            ((IRouteProvider)adapter).CalculateRoutesAsync(
                new Coordinates(0, 0), new Coordinates(1, 1), ActivityType.Driving, 0));
    }
}
```

Tests use `JsonDocument` from `System.Text.Json` — add `using System.Text.Json;` at top of the test file.

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/WeatherRoute.Infrastructure.Tests`
Expected: FAIL (types missing).

- [ ] **Step 3: Implement options, profiles, exception**

```csharp
// Routing/OpenRouteServiceOptions.cs
namespace WeatherRoute.Infrastructure.Routing;

public sealed class OpenRouteServiceOptions
{
    public string BaseUrl { get; set; } = "https://api.openrouteservice.org";
    public string ApiKey { get; set; } = string.Empty;
}
```

```csharp
// Routing/OrsProfiles.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Infrastructure.Routing;

public static class OrsProfiles
{
    public static string Map(ActivityType activity) => activity switch
    {
        ActivityType.Walking or ActivityType.Running => "foot-walking",
        ActivityType.Cycling => "cycling-regular",
        ActivityType.Motorcycle => "driving-motorcycle",
        ActivityType.Driving => "driving-car",
        _ => throw new ArgumentOutOfRangeException(nameof(activity), activity, null)   };
}
```

```csharp
// Routing/GeocodingException.cs
namespace WeatherRoute.Infrastructure.Routing;

public sealed class GeocodingException : Exception
{
    public GeocodingException(string message) : base(message) { }
}
```

- [ ] **Step 4: Implement the adapter**

```csharp
// Routing/OpenRouteServiceRoutingAdapter.cs
using System.Text;
using System.Text.Json;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Infrastructure.Routing;

public sealed class OpenRouteServiceRoutingAdapter : IGeocodingProvider, IRouteProvider
{
    private readonly HttpClient _http;
    private readonly OpenRouteServiceOptions _options;

    public OpenRouteServiceRoutingAdapter(HttpClient http, OpenRouteServiceOptions options)
    {
        _http = http;
        _options = options;
    }

    public async Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query))
            throw new GeocodingException("Query cannot be empty.");
        var encoded = Uri.EscapeDataString(query.Trim());
        using var resp = await _http.GetAsync($"/v2/geocode/search?text={encoded}", ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var features = doc.RootElement.GetProperty("features");
        if (features.GetArrayLength() == 0)
            throw new GeocodingException($"No geocoding result for '{query}'.");
        var coords = features[0].GetProperty("geometry").GetProperty("coordinates");
        return new Coordinates(coords[1].GetDouble(), coords[0].GetDouble());
    }

    public async Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(
        Coordinates origin,
        Coordinates destination,
        ActivityType activity,
        int alternativeCount,
        CancellationToken ct = default)
    {
        var profile = OrsProfiles.Map(activity);
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/v2/directions/{profile}");
        req.Headers.Add("Authorization", _options.ApiKey);
        req.Content = new StringContent(JsonSerializer.Serialize(new
        {
            coordinates = new[] { new[] { origin.Longitude, origin.Latitude }, new[] { destination.Longitude, destination.Latitude } },
            alternative_routes = new { target_count = alternativeCount, weight_factor = 0.9 },
            geometry = true,
            instructions = false
        }), Encoding.UTF8, "application/json");

        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));

        var result = new List<ExternalRoute>();
        foreach (var routeEl in doc.RootElement.GetProperty("routes").EnumerateArray())
        {
            var summary = routeEl.GetProperty("summary");
            double distance = summary.GetProperty("distance").GetDouble();
            int durationSeconds = summary.GetProperty("duration").GetInt32();
            var geometry = routeEl.GetProperty("geometry").GetProperty("coordinates");

            var points = new List<Coordinates>();
            foreach (var p in geometry.EnumerateArray())
                points.Add(new Coordinates(p[1].GetDouble(), p[0].GetDouble()));

            result.Add(new ExternalRoute(profile, distance / 1000.0, TimeSpan.FromSeconds(durationSeconds), points));
        }

        return result;
    }
}
```

- [ ] **Step 5: Run tests to verify pass**

Run: `dotnet test tests/WeatherRoute.Infrastructure.Tests`
Expected: PASS (adapter unit tests; no live API calls).

- [ ] **Step 6: Commit**

```bash
git add backend tests
git commit -m "feat: OpenRouteService routing and geocoding adapter"
```

---

### Task 6: Open-Meteo weather adapter

**Files:**
- Create: `backend/WeatherRoute.Infrastructure/Weather/WeatherCodeMapper.cs`, `Weather/OpenMeteoWeatherAdapter.cs`
- Test: `tests/WeatherRoute.Infrastructure.Tests/OpenMeteoWeatherAdapterTests.cs`

**Interfaces:**
- Consumes: `IWeatherProvider`, `ExternalWeather` (Task 4).
- Produces: `OpenMeteoWeatherAdapter : IWeatherProvider` with ctor `(HttpClient http)`.

- [ ] **Step 1: Write failing tests**

`tests/WeatherRoute.Infrastructure.Tests/OpenMeteoWeatherAdapterTests.cs`:
```csharp
using System.Globalization;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Weather;

namespace WeatherRoute.Infrastructure.Tests;

public class OpenMeteoWeatherAdapterTests
{
    private static OpenMeteoWeatherAdapter Build(Func<HttpRequestMessage, string> responder) =>
        new(new HttpClient(new StubHandler(responder)) { BaseAddress = new Uri("https://api.open-meteo.com") });

    [Fact]
    public async Task Returns_Temperature_And_Condition()
    {
        var adapter = Build(req =>
        {
            Assert.StartsWith("/v1/forecast?", req.RequestUri!.PathAndQuery);
            var q = req.RequestUri!.Query;
            Assert.Contains("hourly=temperature_2m", q);
            Assert.Contains("timezone=UTC", q);
            return """
            {
              "hourly": {
                "time": ["2026-09-27T07:00", "2026-09-27T08:00"],
                "temperature_2m": [17.2, 18.4],
                "wind_speed_10m": [8.0, 9.2],
                "precipitation_probability": [10, 12],
                "uv_index": [2.1, 3.0],
                "visibility": [20000, 10000],
                "relative_humidity_2m": [60, 58],
                "weather_code": [1, 95]
              }
            }
            """;
        });

        var weather = await adapter.GetForecastAsync(
            new Coordinates(38.986, -3.929),
            new DateTime(2026, 9, 27, 8, 30, 0, DateTimeKind.Utc));

        Assert.NotNull(weather);
        Assert.Equal(18.4, weather!.TemperatureC!.Value, 1);
        Assert.Equal(9.2, weather.WindKmh!.Value, 1);
        Assert.Equal(12, weather.PrecipitationProbability);
        Assert.Equal(3, weather.UvIndex);
        Assert.Equal(10, weather.VisibilityKm);   // 10000 m -> 10 km
        Assert.Equal(WeatherCondition.Storm, weather.Condition);
    }

    [Fact]
    public async Task Out_Of_Range_Returns_Null()
    {
        var adapter = Build(_ => """{"hourly":{"time":[],"temperature_2m":[],"wind_speed_10m":[],"precipitation_probability":[],"uv_index":[],"visibility":[],"relative_humidity_2m":[],"weather_code":[]}}""");

        var weather = await adapter.GetForecastAsync(
            new Coordinates(0, 0),
            new DateTime(2030, 1, 1, 0, 0, 0, DateTimeKind.Utc));

        Assert.Null(weather);
    }
}
```

Assertional precision: `0.1` tolerance used for temperature. Ensure using `Assert.Equal(18.4, value, 1)`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/WeatherRoute.Infrastructure.Tests`
Expected: FAIL.

- [ ] **Step 3: Implement weather code mapper**

```csharp
// Weather/WeatherCodeMapper.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Infrastructure.Weather;

public static class WeatherCodeMapper
{
    public static WeatherCondition Map(int wmo) => wmo switch
    {
        0 or 1 => WeatherCondition.Clear,
        2 or 3 => WeatherCondition.Clouds,
        45 or 48 => WeatherCondition.Fog,
        >= 51 and <= 67 or >= 80 and <= 82 or 85 or 86 => WeatherCondition.Rain,
        71 or 73 or 75 or 77 => WeatherCondition.Snow,
        95 or 96 or 99 => WeatherCondition.Storm,
        _ => WeatherCondition.Unknown
    };
}
```

- [ ] **Step 4: Implement the adapter**

```csharp
// Weather/OpenMeteoWeatherAdapter.cs
using System.Text.Json;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Infrastructure.Weather;

public sealed class OpenMeteoWeatherAdapter : IWeatherProvider
{
    private readonly HttpClient _http;
    private const string Hourly =
        "temperature_2m,wind_speed_10m,precipitation_probability,uv_index,visibility,relative_humidity_2m,weather_code";

    public OpenMeteoWeatherAdapter(HttpClient http) => _http = http;

    public async Task<ExternalWeather?> GetForecastAsync(
        Coordinates coordinates, DateTime timestampUtc, CancellationToken ct = default)
    {
        var utc = timestampUtc.ToUniversalTime();
        var path = $"/v1/forecast?" +
                   $"latitude={coordinates.Latitude.ToString("0.0000")}&" +
                   $"longitude={coordinates.Longitude.ToString("0.0000")}&" +
                   $"hourly={Hourly}&timezone=UTC&" +
                   $"start_date={utc.Date:yyyy-MM-dd}&end_date={utc.Date.AddDays(1):yyyy-MM-dd}";

        using var resp = await _http.GetAsync(path, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));

        var hourly = doc.RootElement.GetProperty("hourly");
        var times = hourly.GetProperty("time");
        var target = new DateTime(utc.Year, utc.Month, utc.Day, utc.Hour, 0, 0, DateTimeKind.Utc);
        int index = -1;
        bool found = false;
        foreach (var t in times.EnumerateArray())
        {
            index++;
            if (DateTime.Parse(t.GetString()!, CultureInfo.InvariantCulture) == target)
            {
                found = true;
                break;
            }
        }
        if (!found || index < 0)
            return null;

        return new ExternalWeather(
            GetHourly<double?>(hourly, "temperature_2m", index),
            GetHourly<double?>(hourly, "wind_speed_10m", index),
            GetHourly<double?>(hourly, "precipitation_probability", index),
            (int?)Math.Round(GetHourly<double?>(hourly, "uv_index", index) ?? 0),
            (GetHourly<double?>(hourly, "visibility", index) is { } v) ? v / 1000.0 : null,
            WeatherCodeMapper.Map((int)(GetHourly<double?>(hourly, "weather_code", index) ?? 0)));
    }

    private static T? GetHourly<T>(JsonElement hourly, string field, int index) where T : struct
    {
        if (!hourly.TryGetProperty(field, out var arr) || index >= arr.GetArrayLength())
            return null;
        var token = arr[index];
        if (token.ValueKind == JsonValueKind.Null)
            return null;
        return token.GetDouble() is { } d ? (T)Convert.ChangeType(d, typeof(T), CultureInfo.InvariantCulture) : null;
    }
}
```

Add `using System.Globalization;` and `using System.Linq;` (ImplicitUsings covers System.Linq).

- [ ] **Step 5: Run tests to verify pass**

Run: `dotnet test tests/WeatherRoute.Infrastructure.Tests`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend tests
git commit -m "feat: Open-Meteo weather adapter with WMO mapping"
```

---

### Task 7: Route sampler (Application)

**Files:**
- Create: `backend/WeatherRoute.Application/Services/IRouteSampler.cs`, `Services/ActivityPace.cs`, `Services/RouteSampler.cs`
- Test: `tests/WeatherRoute.Application.Tests/RouteSamplerTests.cs`

**Interfaces:**
- Consumes: `ExternalRoute` (Task 4), domain `Route`/`RouteSegment` (Task 3), `ActivityType` (Task 2).
- Produces:
  - `ActivityPace.GetKmh(ActivityType)` → `double`
  - `RouteSampler.Sample(ExternalRoute route, ActivityType activity, DateTime departureUtc)` → `Route` with segments carrying `SetArrival` (cumulative arrival offset from departure, stored as `TimeSpan?`).
  - Sampling: walk the geometry accumulating distance; emit a segment boundary every ~10 km or at geometry end; max 20 points/samples.

- [ ] **Step 1: Write failing tests**

`tests/WeatherRoute.Application.Tests/RouteSamplerTests.cs`:
```csharp
using WeatherRoute.Application.Services;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Tests;

public class RouteSamplerTests
{
    private static ExternalRoute StraightLine(double distanceKm, int points)
    {
        var geom = Enumerable.Range(0, points)
            .Select(i => new Coordinates(0, i * (distanceKm / (points - 1)) / 111.0))
            .ToList();
        var hours = Math.Round(distanceKm / ActivityPace.GetKmh(WeatherRoute.Domain.Enums.ActivityType.Cycling), 4);
        return new ExternalRoute("test", distanceKm, TimeSpan.FromHours(hours), geom);
    }

    [Fact]
    public void Samples_Every_10Km_And_Sets_Arrival()
    {
        var sampler = new RouteSampler();
        var route = sampler.Sample(StraightLine(40, 401), Domain.Enums.ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.True(route.Segments.Count >= 3);      // 0..10..20..30..40
        Assert.Equal(40, route.TotalDistance.Km, 1);
        Assert.Equal(TimeSpan.FromHours(2), route.TotalDuration, TimeSpan.FromMinutes(5));
        var last = route.Segments[^1];
        Assert.NotNull(last.ArrivalTime);
    }

    [Fact]
    public void Short_Route_Produces_Single_Segment()
    {
        var sampler = new RouteSampler();
        var route = sampler.Sample(StraightLine(2, 11), Domain.Enums.ActivityType.Walking,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.Single(route.Segments);
        Assert.Equal(2, route.TotalDistance.Km, 1);
    }
}
```

`RouteSamplerTests` references `Enumerable` from `System.Linq` (implicit).

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/WeatherRoute.Application.Tests`
Expected: FAIL (`RouteSampler` missing).

- [ ] **Step 3: Implement pace + sampler**

```csharp
// Services/ActivityPace.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Services;

public static class ActivityPace
{
    public static double GetKmh(ActivityType activity) => activity switch
    {
        ActivityType.Walking => 5,
        ActivityType.Running => 10,
        ActivityType.Cycling => 20,
        ActivityType.Motorcycle => 60,
        ActivityType.Driving => 60,
        _ => 20
    };
}
```

```csharp
// Services/IRouteSampler.cs
using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Services;

public interface IRouteSampler
{
    Route Sample(ExternalRoute route, ActivityType activity, DateTime departureUtc);
}
```

```csharp
// Services/RouteSampler.cs
using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Services;

public sealed class RouteSampler : IRouteSampler
{
    private const double SegmentKm = 10.0;
    private const int MaxSamples = 20;

    public Route Sample(ExternalRoute route, ActivityType activity, DateTime departureUtc)
    {
        double speed = ActivityPace.GetKmh(activity);
        var geometry = route.Geometry;
        var samples = new List<(Coordinates Point, double CumulativeKm)> { (geometry[0], 0) };

        double cum = 0;
        double target = SegmentKm;
        for (int i = 1; i < geometry.Count && samples.Count < MaxSamples; i++)
        {
            cum += geometry[i - 1].DistanceKmTo(geometry[i]);
            if (cum >= target)
            {
                samples.Add((geometry[i], cum));
                target += SegmentKm;
            }
        }
        if (samples.Count < 2 || samples[^1].Point != geometry[^1])
        {
            if (samples.Count < MaxSamples)
                samples.Add((geometry[^1], cum));
            else
                samples[^1] = (geometry[^1], cum);
        }

        var segments = new List<RouteSegment>(samples.Count - 1);
        double prevKm = 0;
        TimeSpan elapsed = TimeSpan.Zero;
        for (int i = 1; i < samples.Count; i++)
        {
            double km = samples[i].CumulativeKm - prevKm;
            double hours = km / speed;
            var duration = TimeSpan.FromHours(hours);
            var seg = new RouteSegment(
                samples[i - 1].Point, samples[i].Point,
                new Distance(km), duration, i - 1, i);
            seg.SetArrival(elapsed + duration);
            segments.Add(seg);
            elapsed += duration;
            prevKm = samples[i].CumulativeKm;
        }

        var sampledGeometry = samples.Select(s => s.Point).ToList();
        return new Route(activity, segments, sampledGeometry);
    }
}
```

Concern: `samples[^1].Point != geometry[^1]` — record equality works. If the loop stops at MaxSamples, last sample may not be exact end until we force it. The final `else` replaces the last sample with the route end; acceptable for display, though it overwrites a sampled point. Note: for the common case (under 200 km), `samples` will already end at the geometry end via the loop condition when `i == geometry.Count-1` (loop breaks before processing last point, so the final endpoint is never added inside the loop; the trailing add handles it).

- [ ] **Step 4: Run tests to verify pass**

Run: `dotnet test tests/WeatherRoute.Application.Tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend tests
git commit -m "feat: route sampler with 10km segments and arrival times"
```

---
### Task 8: CalculateRouteUseCase + risk port with default service

**Files:**
- Create: `backend/WeatherRoute.Domain/Services/RiskAssessment.cs` (records `RiskFactor`, `RiskAssessment`)
- Create: `backend/WeatherRoute.Application/Ports/In/ICalculateRouteUseCase.cs` (`ICalculateRouteUseCase`, `CalculateRouteCommand`)
- Create: `backend/WeatherRoute.Application/Ports/In/IRiskAssessmentService.cs`
- Create: `backend/WeatherRoute.Application/Services/DefaultRiskService.cs`
- Create: `backend/WeatherRoute.Application/Dtos/RouteAnalysisResponse.cs` (`RouteAnalysisResponse`, `RouteCandidate`, `SegmentResult`)
- Create: `backend/WeatherRoute.Application/UseCases/CalculateRouteUseCase.cs`
- Test: `tests/WeatherRoute.Application.Tests/CalculateRouteUseCaseTests.cs` (+ `Fakes.cs`)

**Interfaces:**
- Consumes: output ports (Task 4), `RouteSampler`/`IRouteSampler` (Task 7), domain `Route`/`RouteSegment` (Task 3), `ExternalWeather` (Task 4).
- Produces:
  - `RiskFactor(string Type, string Level, int Contribution, string Message)`, `RiskAssessment(RiskLevel Level, int Score, IReadOnlyList<RiskFactor> Factors)` (Domain).
  - `IRiskAssessmentService.Assess(Route route)` → `RiskAssessment`.
  - `CalculateRouteCommand(string Origin, string Destination, ActivityType Activity, DateTime DepartureTimeUtc, int? MaxDurationMinutes)`.
  - `ICalculateRouteUseCase.ExecuteAsync(CalculateRouteCommand, CancellationToken)` → `RouteAnalysisResponse`.
  - `RouteAnalysisResponse(bool WeatherAvailable, bool RouteAvailable, string? Recommendation, IReadOnlyList<RouteCandidate> Routes)` with `Status => "full"|"partial"`.
  - `RouteCandidate(string ProviderId, double DistanceKm, int DurationMinutes, RiskLevel RiskLevel, int RiskScore, IReadOnlyList<RiskFactor> Factors, IReadOnlyList<SegmentResult> Segments, IReadOnlyList<Coordinates> Polyline)`.
  - `SegmentResult(int FromIndex, int ToIndex, double DistanceKm, DateTime? ArrivalTimeUtc, ExternalWeather? Weather)`.
  - Behavior: geocode origin+dest; request up to 3 candidate routes; sample each; forecast per segment midpoint at arrival time (null-safe, transient failures → partial); filter by `MaxDurationMinutes`; risk per route; recommendation = highest score then shortest duration; persists nothing.

- [ ] **Step 1: Write failing tests + fakes**

`tests/WeatherRoute.Application.Tests/Fakes.cs`:
```csharp
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Tests;

public sealed class FakeGeocoder : IGeocodingProvider
{
    public Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default) =>
        Task.FromResult<Coordinates>(query.ToLowerInvariant().Contains("alma")
            ? new Coordinates(38.888, -3.712)
            : new Coordinates(38.986, -3.929));
}

public sealed class FakeRouteProvider : IRouteProvider
{
    public Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(
        Coordinates o, Coordinates d, ActivityType a, int alternativeCount, CancellationToken ct = default)
    {
        var geom = new[] { o, new Coordinates((o.Latitude + d.Latitude) / 2, (o.Longitude + d.Longitude) / 2), d };
        var list = new List<ExternalRoute>
        {
            new("fake-a", 40, TimeSpan.FromHours(2), geom),
            new("fake-b", 50, TimeSpan.FromHours(2.5), geom)
        };
        return Task.FromResult<IReadOnlyList<ExternalRoute>>(list);
    }
}

public sealed class FakeWeather : IWeatherProvider
{
    public bool Fail { get; set; }
    public Task<ExternalWeather?> GetForecastAsync(Coordinates coordinates, DateTime timestampUtc, CancellationToken ct = default) =>
        Fail ? throw new HttpRequestException("upstream down")
             : Task.FromResult<ExternalWeather?>(new ExternalWeather(27, 30, 5, 3, 4, WeatherCondition.Clear));
}
```

`tests/WeatherRoute.Application.Tests/CalculateRouteUseCaseTests.cs`:
```csharp
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Services;
using WeatherRoute.Application.UseCases;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Tests;

public class CalculateRouteUseCaseTests
{
    private static ICalculateRouteUseCase Build(FakeWeather weather) => new CalculateRouteUseCase(
        new FakeGeocoder(),
        new FakeRouteProvider(),
        weather, new RouteSampler(), new DefaultRiskService());

    [Fact]
    public async Task Returns_Two_Weather_Enriched_Routes()
    {
        var weather = new FakeWeather();
        var useCase = Build(weather);

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), null));

        Assert.Equal("full", result.Status);
        Assert.True(result.WeatherAvailable);
        Assert.Equal(2, result.Routes.Count);
        Assert.All(result.Routes, r => Assert.Contains(r.Segments, s => s.Weather is not null));
        Assert.NotNull(result.Recommendation);
    }

    [Fact]
    public async Task Filters_By_MaxDuration()
    {
        var weather = new FakeWeather();
        var useCase = Build(weather);

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), 120));

        Assert.Single(result.Routes);                            // fake-a = 120 min passes, fake-b = 150 min filtered
        Assert.True(result.Routes[0].DurationMinutes <= 120);
    }

    [Fact]
    public async Task Partial_When_Weather_Fails()
    {
        var failingWeather = new FakeWeather { Fail = true };
        var useCase = Build(failingWeather);

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), null));

        Assert.Equal("partial", result.Status);
        Assert.False(result.WeatherAvailable);
        Assert.True(result.RouteAvailable);
    }
}
```

Update `FakeWeather` with `public bool Fail { get; set; }` and throw when set:
```csharp
public sealed class FakeWeather : IWeatherProvider
{
    public bool Fail { get; set; }
    public Task<ExternalWeather?> GetForecastAsync(Coordinates coordinates, DateTime timestampUtc, CancellationToken ct = default) =>
        Fail ? throw new HttpRequestException("upstream down")
             : Task.FromResult<ExternalWeather?>(new ExternalWeather(27, 30, 5, 3, 4, WeatherCondition.Clear));
}
```

(same value as the `FakeWeather` in `Fakes.cs` above — keep in sync.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `dotnet test tests/WeatherRoute.Application.Tests`
Expected: FAIL (types missing).

- [ ] **Step 3: Domain RiskAssessment + Application risk port**

```csharp
// Domain/Services/RiskAssessment.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public sealed record RiskFactor(string Type, string Level, int Contribution, string Message);

public sealed class RiskAssessment
{
    public RiskAssessment(RiskLevel level, int score, IReadOnlyList<RiskFactor> factors)
    {
        Level = level;
        Score = score;
        Factors = factors;
    }

    public RiskLevel Level { get; }
    public int Score { get; }
    public IReadOnlyList<RiskFactor> Factors { get; }
}
```

```csharp
// Ports/In/IRiskAssessmentService.cs
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Ports.In;

public interface IRiskAssessmentService
{
    RiskAssessment Assess(Route route);
}
```

```csharp
// Services/DefaultRiskService.cs
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Services;

public sealed class DefaultRiskService : IRiskAssessmentService
{
    public RiskAssessment Assess(Route route) => new(RiskLevel.Low, 100, Array.Empty<RiskFactor>());
}
```

- [ ] **Step 4: Input port + commands**

```csharp
// Ports/In/ICalculateRouteUseCase.cs
using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Ports.In;

public interface ICalculateRouteUseCase
{
    Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default);
}

public sealed record CalculateRouteCommand(
    string Origin,
    string Destination,
    ActivityType Activity,
    DateTime DepartureTimeUtc,
    int? MaxDurationMinutes = null);
```

- [ ] **Step 5: Result DTOs**

```csharp
// Dtos/RouteAnalysisResponse.cs
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Dtos;

public sealed record RouteAnalysisResponse(
    bool WeatherAvailable,
    bool RouteAvailable,
    string? Recommendation,
    IReadOnlyList<RouteCandidate> Routes)
{
    public string Status => WeatherAvailable && RouteAvailable ? "full" : "partial";
}

public sealed record RouteCandidate(
    string ProviderId,
    double DistanceKm,
    int DurationMinutes,
    RiskLevel RiskLevel,
    int RiskScore,
    IReadOnlyList<RiskFactor> Factors,
    IReadOnlyList<SegmentResult> Segments,
    IReadOnlyList<Coordinates> Polyline);

public sealed record SegmentResult(
    int FromIndex,
    int ToIndex,
    double DistanceKm,
    DateTime? ArrivalTimeUtc,
    ExternalWeather? Weather);
```

- [ ] **Step 6: Implement use case**

```csharp
// UseCases/CalculateRouteUseCase.cs
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Application.Services;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.UseCases;

public sealed class CalculateRouteUseCase : ICalculateRouteUseCase
{
    private readonly IGeocodingProvider _geocoding;
    private readonly IRouteProvider _routes;
    private readonly IWeatherProvider _weather;
    private readonly IRouteSampler _sampler;
    private readonly IRiskAssessmentService _risk;

    public CalculateRouteUseCase(
        IGeocodingProvider geocoding,
        IRouteProvider routes,
        IWeatherProvider weather,
        IRouteSampler sampler,
        IRiskAssessmentService risk)
    {
        _geocoding = geocoding;
        _routes = routes;
        _weather = weather;
        _sampler = sampler;
        _risk = risk;
    }

    public async Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default)
    {
        try
        {
            var origin = await _geocoding.GeocodeAsync(command.Origin, ct);
            var destination = await _geocoding.GeocodeAsync(command.Destination, ct);
            var external = await _routes.CalculateRoutesAsync(origin, destination, command.Activity, 2, ct);

            var candidates = new List<RouteCandidate>();
            bool anyWeather = false;
            foreach (var ext in external)
            {
                var route = _sampler.Sample(ext, command.Activity, command.DepartureTimeUtc);
                var segments = new List<SegmentResult>();
                bool hasWeather = false;

                foreach (var seg in route.Segments)
                {
                    var arrivalUtc = command.DepartureTimeUtc.Add(seg.ArrivalTime ?? TimeSpan.Zero);
                    var midpoint = new Coordinates(
                        (seg.Start.Latitude + seg.End.Latitude) / 2,
                        (seg.Start.Longitude + seg.End.Longitude) / 2);
                    ExternalWeather? weather = null;
                    try
                    {
                        weather = await _weather.GetForecastAsync(midpoint, arrivalUtc, ct);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        weather = null;
                    }
                    if (weather is not null) hasWeather = true;

                    segments.Add(new SegmentResult(seg.StartPointIndex, seg.EndPointIndex, seg.Distance.Km,
                        arrivalUtc, weather));
                }

                anyWeather |= hasWeather;
                var risk = _risk.Assess(route);
                var polyline = route.Geometry
                    .Select(p => new Coordinates(p.Latitude, p.Longitude))
                    .ToList();
                candidates.Add(new RouteCandidate(ext.ProviderId, route.TotalDistance.Km,
                    (int)Math.Ceiling(route.TotalDuration.TotalMinutes), risk.Level, risk.Score,
                    risk.Factors, segments, polyline));
            }

            if (command.MaxDurationMinutes is { } max)
                candidates = candidates.Where(c => c.DurationMinutes <= max).ToList();

            var recommendation = Recommend(candidates);
            return new RouteAnalysisResponse(anyWeather, candidates.Count > 0, recommendation, candidates);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new RouteAnalysisResponse(false, false, null, Array.Empty<RouteCandidate>());
        }
    }

    private static string? Recommend(IReadOnlyList<RouteCandidate> candidates)
    {
        if (candidates.Count == 0) return null;
        var best = candidates
            .OrderByDescending(c => c.RiskScore)
            .ThenBy(c => c.DurationMinutes)
            .First();
        int index = candidates.IndexOf(best) + 1;
        return $"Route #{index}: {best.DistanceKm:0.#} km, {best.DurationMinutes} min, risk {best.RiskLevel}.";
    }
}
```

Note: the try/catch swallows any provider failure into `partial`; with zero routes the response has `RouteAvailable=false`.

- [ ] **Step 7: Run tests to verify pass**

Run: `dotnet test tests/WeatherRoute.Application.Tests`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add backend tests
git commit -m "feat: CalculateRouteUseCase orchestrating geocode, route, weather, risk"
```

---

### Task 9: Web API — endpoints, validation, DI

**Files:**
- Create: `backend/WeatherRoute.Api/Program.cs` (rewrite), `appsettings.json`, `appsettings.Development.json`
- Create: `backend/WeatherRoute.Api/Requests/CalculateRouteRequest.cs`, `Requests/CalculateRouteRequestValidator.cs`, `Requests/GeocodeQuery.cs`
- Create: `tests/WeatherRoute.Api.IntegrationTests/WeatherRoute.Api.IntegrationTests.csproj` + `ApiSmokeTests.cs`
- Modify: `backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj` (add `Microsoft.Extensions.Http`, `Microsoft.Extensions.Options.ConfigurationExtensions`)

**Interfaces:**
- Consumes: all Application/Infrastructure types.
- Produces: endpoints `POST /api/routes/analyze`, `GET /api/geocode`, `GET /`; DI wiring for adapters, sampler, use case, validators; CORS; JSON enum-as-string. Integration test project green.

- [ ] **Step 1: Add Infrastructure packages**

`backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <ItemGroup>
    <PackageReference Include="Microsoft.Extensions.Http" Version="10.0.*" />
    <PackageReference Include="Microsoft.Extensions.Options.ConfigurationExtensions" Version="10.0.*" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\WeatherRoute.Application\WeatherRoute.Application.csproj" />
    <ProjectReference Include="..\WeatherRoute.Domain\WeatherRoute.Domain.csproj" />
  </ItemGroup>
</Project>
```

- [ ] **Step 2: Application packages (FluentValidation)**

`backend/WeatherRoute.Application/WeatherRoute.Application.csproj` — add:
```xml
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" Version="12.*" />
```

- [ ] **Step 3: Requests + validator**

```csharp
// Requests/CalculateRouteRequest.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.Requests;

public sealed record CalculateRouteRequest(
    string Origin,
    string Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    int? MaxDurationMinutes = null);
```

```csharp
// Requests/CalculateRouteRequestValidator.cs
using FluentValidation;

namespace WeatherRoute.Api.Requests;

public sealed class CalculateRouteRequestValidator : AbstractValidator<CalculateRouteRequest>
{
    public CalculateRouteRequestValidator()
    {
        RuleFor(x => x.Origin).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Destination).NotEmpty().MaximumLength(200);
        RuleFor(x => x.DepartureTime).NotEmpty();
        RuleFor(x => x.MaxDurationMinutes).GreaterThan(0).When(x => x.MaxDurationMinutes.HasValue);
    }
}
```

```csharp
// Requests/GeocodeQuery.cs
namespace WeatherRoute.Api.Requests;

public sealed record GeocodeQuery(string? Q, int Limit = 1);
```

- [ ] **Step 4: Add Api packages + rewrite Program.cs**

`backend/WeatherRoute.Api/WeatherRoute.Api.csproj` — add:
```xml
    <PackageReference Include="FluentValidation.DependencyInjectionExtensions" Version="12.*" />
```

`backend/WeatherRoute.Api/Program.cs`:
```csharp
using System.Text.Json.Serialization;
using FluentValidation;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Application.Services;
using WeatherRoute.Api.Requests;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Infrastructure.Routing;
using WeatherRoute.Infrastructure.Weather;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<OpenRouteServiceOptions>(
    builder.Configuration.GetSection(nameof(OpenRouteServiceOptions)));

builder.Services.AddTransient<IRouteSampler, RouteSampler>();
builder.Services.AddTransient<IRiskAssessmentService, DefaultRiskService>();
builder.Services.AddSingleton<IGeocodingProvider>(sp =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenRouteServiceOptions>>().Value;
    return new OpenRouteServiceRoutingAdapter(sp.GetRequiredService<IHttpClientFactory>().CreateClient("ors"), options);
});
builder.Services.AddSingleton<IRouteProvider>(sp =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenRouteServiceOptions>>().Value;
    return new OpenRouteServiceRoutingAdapter(sp.GetRequiredService<IHttpClientFactory>().CreateClient("ors"), options);
});
builder.Services.AddTransient<IWeatherProvider>(_ => new OpenMeteoWeatherAdapter(new HttpClient
{
    BaseAddress = new Uri("https://api.open-meteo.com")
}));
builder.Services.AddScoped<ICalculateRouteUseCase, WeatherRoute.Application.UseCases.CalculateRouteUseCase>();

builder.Services.AddHttpClient("ors", (sp, client) =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenRouteServiceOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl);
});

builder.Services.AddValidatorsFromAssemblyContaining<CalculateRouteRequestValidator>();

var frontend = builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173";
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(frontend).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();
app.UseCors();
app.MapControllers();
app.MapGet("/", () => "WeatherRoute API");
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.Run();

public partial class Program;
```

- [ ] **Step 5: API controllers (minimal API group)**

Create `backend/WeatherRoute.Api/Endpoints/RouteEndpoints.cs`:
```csharp
using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Api.Requests;

namespace WeatherRoute.Api.Endpoints;

public static class RouteEndpoints
{
    public static void MapRouteEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("routes");

        group.MapPost("/routes/analyze", async (
            CalculateRouteRequest request,
            ICalculateRouteUseCase useCase,
            IValidator<CalculateRouteRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(request, ct);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());
            var command = new CalculateRouteCommand(request.Origin, request.Destination,
                request.Activity, request.DepartureTime.Kind == DateTimeKind.Utc
                    ? request.DepartureTime
                    : DateTime.SpecifyKind(request.DepartureTime, DateTimeKind.Utc),
                request.MaxDurationMinutes);
            var result = await useCase.ExecuteAsync(command, ct);
            return Results.Ok(result);
        });

        group.MapGet("/geocode", async (
            [FromQuery] string? q,
            IGeocodingProvider geocoding,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(q)) return Results.BadRequest(new { error = "Missing q." });
            try
            {
                var coord = await geocoding.GeocodeAsync(q, ct);
                return Results.Ok(new { query = q, coordinates = new { lat = coord.Latitude, lon = coord.Longitude } });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });
    }
}
```

Wire it in `Program.cs` before `app.Run()`:
```csharp
using WeatherRoute.Api.Endpoints;
app.MapRouteEndpoints();
```

- [ ] **Step 6: appsettings**

`backend/WeatherRoute.Api/appsettings.json`:
```json
{
  "OpenRouteServiceOptions": {
    "BaseUrl": "https://api.openrouteservice.org",
    "ApiKey": ""
  },
  "FrontendOrigin": "http://localhost:5173",
  "Logging": { "LogLevel": { "Default": "Information", "Microsoft.AspNetCore": "Warning" } },
  "AllowedHosts": "*",
  "ConnectionStrings": { "DefaultConnection": "Host=localhost;Database=weatherroute;Username=weatherroute;Password=weatherroute" },
  "Redis": { "ConnectionString": "localhost:6379" }
}
```

Note: config section key `OpenRouteServiceOptions` matches the class name so `GetSection(nameof(...))` binds.

- [ ] **Step 7: Integration test project + smoke test**

`tests/WeatherRoute.Api.IntegrationTests/WeatherRoute.Api.IntegrationTests.csproj`:
```xml
<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup>
    <IsPackable>false</IsPackable>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.AspNetCore.Mvc.Testing" Version="10.0.*" />
    <PackageReference Include="Microsoft.NET.Test.Sdk" Version="17.14.*" />
    <PackageReference Include="xunit" Version="2.9.*" />
    <PackageReference Include="xunit.runner.visualstudio" Version="3.1.*" />
  </ItemGroup>
  <ItemGroup>
    <ProjectReference Include="..\..\backend\WeatherRoute.Api\WeatherRoute.Api.csproj" />
  </ItemGroup>
</Project>
```

`tests/WeatherRoute.Api.IntegrationTests/ApiSmokeTests.cs`:
```csharp
using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

namespace WeatherRoute.Api.IntegrationTests;

public class ApiSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiSmokeTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Health_Returns_Ok()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Root_Returns_Api_Name()
    {
        using var client = _factory.CreateClient();
        var body = await client.GetStringAsync("/");
        Assert.Equal("WeatherRoute API", body);
    }
}
```

Add to solution:
```bash
dotnet sln backend/WeatherRoute.sln add tests/WeatherRoute.Api.IntegrationTests
```

- [ ] **Step 8: Run tests**

Run: `dotnet test backend/WeatherRoute.sln`
Expected: all projects build, tests pass (integration smoke hits no external APIs).

- [ ] **Step 9: Commit**

```bash
git add backend tests
git commit -m "feat: REST API for analyze and geocode with validation"
```

---

### Task 10: Frontend scaffold — Vite app, form, results

**Files:**
- Create: `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`
- Create: `frontend/src/main.tsx`, `frontend/src/App.tsx`, `frontend/src/index.css`
- Create: `frontend/src/types.ts`, `frontend/src/services/api.ts`
- Create: `frontend/src/components/RouteForm.tsx`, `frontend/src/components/RouteResults.tsx`
- Test: `frontend/src/components/RouteForm.test.tsx`, `frontend/test/setup.ts`

**Interfaces:**
- Consumes: REST `POST /api/routes/analyze`, `GET /api/geocode`.
- Produces: SPA that submits a route request and renders per-route distance/duration/weather tables. `api.ts` exports `analyzeRoute(request): Promise<RouteAnalysisResponse>` typed against the backend DTOs.

- [ ] **Step 1: package.json, configs**

`frontend/package.json`:
```json
{
  "name": "weatherroute-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tanstack/react-query": "^5.80.0",
    "maplibre-gl": "^5.0.0",
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-hook-form": "^7.62.0",
    "react-icons": "^5.5.0",
    "recharts": "^3.0.0",
    "zod": "^3.25.0"
  },
  "devDependencies": {
    "@hookform/resolvers": "^5.0.0",
    "@tailwindcss/vite": "^4.1.0",
    "@testing-library/jest-dom": "^6.6.0",
    "@testing-library/react": "^16.2.0",
    "@types/react": "^19.2.0",
    "@types/react-dom": "^19.2.0",
    "@vitejs/plugin-react": "^4.4.0",
    "eslint": "^9.0.0",
    "eslint-plugin-react-hooks": "^5.2.0",
    "globals": "^16.0.0",
    "jsdom": "^26.0.0",
    "tailwindcss": "^4.1.0",
    "typescript": "^5.8.0",
    "vite": "^6.3.0",
    "vitest": "^3.1.0"
  }
}
```

`frontend/vite.config.ts`:
```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:5080",
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./test/setup.ts",
  },
});
```

`frontend/tsconfig.json` (`tsc -b` requires the app config; see next step):
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`frontend/tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"]
}
```

`frontend/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "verbatimModuleSyntax": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
```

`frontend/index.html`:
```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>WeatherRoute</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 2: Install deps**

Run: `cd frontend && npm install`
Expected: lockfile created.

- [ ] **Step 3: Types + api client mirroring backend DTOs**

`frontend/src/types.ts`:
```ts
export type ActivityType = "Walking" | "Running" | "Cycling" | "Motorcycle" | "Driving";

export type RiskLevel = "Low" | "Moderate" | "High" | "Severe";

export interface AnalyzeRequest {
  origin: string;
  destination: string;
  activity: ActivityType;
  departureTime: string;
  maxDurationMinutes?: number | null;
}

export interface RiskFactor {
  type: string;
  level: string;
  contribution: number;
  message: string;
}

export interface ExternalWeather {
  temperatureC: number | null;
  windKmh: number | null;
  precipitationProbability: number | null;
  uvIndex: number | null;
  visibilityKm: number | null;
  condition: string;
}

export interface RouteSegment {
  fromIndex: number;
  toIndex: number;
  distanceKm: number;
  arrivalTimeUtc: string | null;
  weather: ExternalWeather | null;
}

export interface RouteCandidate {
  providerId: string;
  distanceKm: number;
  durationMinutes: number;
  riskLevel: RiskLevel;
  riskScore: number;
  factors: RiskFactor[];
  segments: RouteSegment[];
  polyline: { latitude: number; longitude: number }[];
}

export interface RouteAnalysisResponse {
  status: "full" | "partial";
  weatherAvailable: boolean;
  routeAvailable: boolean;
  recommendation: string | null;
  routes: RouteCandidate[];
}
```

`frontend/src/services/api.ts`:
```ts
import type { AnalyzeRequest, RouteAnalysisResponse } from "../types";

export async function analyzeRoute(request: AnalyzeRequest): Promise<RouteAnalysisResponse> {
  const response = await fetch("/api/routes/analyze", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }
  return (await response.json()) as RouteAnalysisResponse;
}
```

- [ ] **Step 4: App shell with usecase — form + results**

`frontend/src/main.tsx`:
```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
);
```

`frontend/src/index.css`:
```css
@import "tailwindcss";
```

`frontend/src/App.tsx`:
```tsx
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import RouteForm, { type RouteFormValues } from "./components/RouteForm";
import RouteResults from "./components/RouteResults";
import { analyzeRoute } from "./services/api";
import type { RouteAnalysisResponse } from "./types";

export default function App() {
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);

  const mutation = useMutation({
    mutationFn: analyzeRoute,
    onSuccess: setResult,
  });

  function handleSubmit(values: RouteFormValues) {
    mutation.reset();
    setResult(null);
    mutation.mutate({
      ...values,
      departureTime: new Date(values.date + "T" + values.time).toISOString(),
    });
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">WeatherRoute</h1>
      <RouteForm onSubmit={handleSubmit} loading={mutation.isPending} />
      {mutation.isError && (
        <p className="mt-4 text-red-600" role="alert">
          No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.
        </p>
      )}
      {result && <RouteResults result={result} />}
    </main>
  );
}
```

- [ ] **Step 5: RouteForm with react-hook-form + zod**

`frontend/src/components/RouteForm.tsx`:
```tsx
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const routeSchema = z.object({
  origin: z.string().min(1, "Origen requerido"),
  destination: z.string().min(1, "Destino requerido"),
  activity: z.enum(["Walking", "Running", "Cycling", "Motorcycle", "Driving"]),
  date: z.string().min(1, "Fecha requerida"),
  time: z.string().min(1, "Hora requerida"),
  maxDurationMinutes: z.coerce.number().positive().optional().or(z.literal("").transform(() => undefined)),
});

export type RouteFormValues = z.infer<typeof routeSchema>;

interface Props {
  onSubmit: (values: RouteFormValues) => void;
  loading: boolean;
}

export default function RouteForm({ onSubmit, loading }: Props) {
  const { register, handleSubmit, formState: { errors } } = useForm<RouteFormValues>({
    resolver: zodResolver(routeSchema),
    defaultValues: { activity: "Cycling", date: "2026-09-27", time: "08:00" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm md:grid-cols-3">
      <label className="block">
        <span className="text-sm font-medium">Desde</span>
        <input {...register("origin")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Ciudad Real" />
        {errors.origin && <span className="text-sm text-red-600">{errors.origin.message}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium">Hasta</span>
        <input {...register("destination")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Almagro" />
        {errors.destination && <span className="text-sm text-red-600">{errors.destination.message}</span>}
      </label>
      <label className="block">
        <span className="text-sm font-medium">Actividad</span>
        <select {...register("activity")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2">
          <option value="Walking">Caminar</option>
          <option value="Running">Correr</option>
          <option value="Cycling">Bici</option>
          <option value="Motorcycle">Moto</option>
          <option value="Driving">Coche</option>
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Fecha</span>
        <input type="date" {...register("date")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <label className="block">
        <span className="text-sm font-medium">Salida</span>
        <input type="time" {...register("time")} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
      </label>
      <div className="flex items-end">
        <button type="submit" disabled={loading} className="w-full rounded-md bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">
          {loading ? "Calculando…" : "Analizar ruta"}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 6: RouteResults**

`frontend/src/components/RouteResults.tsx`:
```tsx
import type { RouteAnalysisResponse } from "../types";

export default function RouteResults({ result }: { result: RouteAnalysisResponse }) {
  if (result.routes.length === 0) {
    return (
      <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
        No se pudieron calcular rutas. {result.status === "partial" && "El proveedor meteorológico no está disponible."}
      </div>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      {result.recommendation && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 font-medium">
          {result.recommendation}
        </div>
      )}
      {result.routes.map((route, i) => (
        <article key={route.providerId} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold">Ruta #{i + 1}</h2>
            <span className={`rounded-full px-3 py-1 text-sm font-semibold ${riskColor(route.riskLevel)}`}>
              {route.riskLevel} · {route.riskScore}/100
            </span>
          </div>
          <p className="text-slate-600">
            {route.distanceKm.toFixed(1)} km · {Math.floor(route.durationMinutes / 60)}h {route.durationMinutes % 60}m
          </p>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-2">Tramo</th>
                <th>Llegada</th>
                <th>T</th>
                <th>Viento</th>
                <th>Lluvia</th>
                <th>Condición</th>
              </tr>
            </thead>
            <tbody>
              {route.segments.map((seg, j) => (
                <tr key={j} className="border-b border-slate-100">
                  <td className="py-2">{seg.distanceKm.toFixed(1)} km</td>
                  <td>{seg.arrivalTimeUtc ? new Date(seg.arrivalTimeUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  <td>{seg.weather?.temperatureC != null ? `${Math.round(seg.weather.temperatureC)}°C` : "—"}</td>
                  <td>{seg.weather?.windKmh != null ? `${Math.round(seg.weather.windKmh)} km/h` : "—"}</td>
                  <td>{seg.weather?.precipitationProbability != null ? `${seg.weather.precipitationProbability}%` : "—"}</td>
                  <td>{seg.weather?.condition ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </article>
      ))}
    </section>
  );
}

function riskColor(level: string): string {
  switch (level) {
    case "Low": return "bg-emerald-100 text-emerald-800";
    case "Moderate": return "bg-amber-100 text-amber-800";
    case "High": return "bg-orange-100 text-orange-800";
    default: return "bg-red-100 text-red-800";
  }
}
```

- [ ] **Step 7: RouteForm test**

`frontend/test/setup.ts`:
```ts
import "@testing-library/jest-dom/vitest";
```

`frontend/src/components/RouteForm.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import RouteForm from "./RouteForm";

describe("RouteForm", () => {
  it("submits the specified route values", async () => {
    const onSubmit = vi.fn();
    render(<RouteForm onSubmit={onSubmit} loading={false} />);

    await userEvent.clear(screen.getByLabelText(/desde/i));
    await userEvent.type(screen.getByLabelText(/desde/i), "Ciudad Real");
    await userEvent.clear(screen.getByLabelText(/hasta/i));
    await userEvent.type(screen.getByLabelText(/hasta/i), "Almagro");
    await userEvent.click(screen.getByRole("button", { name: /analizar ruta/i }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ origin: "Ciudad Real", destination: "Almagro", activity: "Cycling" }),
    );
  });
});
```

Add `@testing-library/user-event` to devDependencies.

- [ ] **Step 8: Run frontend checks**

Run: `cd frontend && npm run typecheck && npm test && npm run build`
Expected: passes. (Vite proxy only matters at `npm run dev`.)

- [ ] **Step 9: Commit**

```bash
git add frontend
git commit -m "feat: Vite React frontend with route form and results table"
```

---

### Task 11: CI for backend + frontend

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: workflow green on `pull_request` (build .NET, unit + integration tests, frontend build/test/lint).

- [ ] **Step 1: Write workflow**

`.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-dotnet@v4
        with:
          dotnet-version: '10.0.x'
      - name: Restore
        run: dotnet restore backend/WeatherRoute.sln
      - name: Build
        run: dotnet build backend/WeatherRoute.sln --no-restore -warnaserror
      - name: Test
        run: dotnet test backend/WeatherRoute.sln --no-build --filter "Category!=Integration"
      - name: Contract tests (against public APIs)
        run: dotnet test backend/WeatherRoute.sln --no-build --filter "Category=Integration"
        env:
          OPENROUTESERVICE_API_KEY: ${{ secrets.OPENROUTESERVICE_API_KEY }}
        continue-on-error: true

  frontend:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 24
          cache: npm
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run lint || true
```

- [ ] **Step 2: Wire .sln test-category filter prerequisites**

Contract tests (Task 6 enhancement) — tag `OpenMeteoWeatherAdapterTests` and ORS adapter tests that hit live APIs with `[Trait("Category", "Integration")]` only when they actually hit the network. In the unit tests above they use `StubHandler`, so no live calls: leave them untagged. The live contract tests are added in Task 16 (Step 5, `AdaptersContractTests`). For now the CI `Category=Integration` filter matches nothing, which is fine.

- [ ] **Step 3: Commit**

```bash
git add .github
git commit -m "ci: GitHub Actions for backend and frontend"
```

---
### Task 12: Domain risk engine — per-activity strategies

**Files:**
- Create: `backend/WeatherRoute.Domain/Services/IRouteRiskEngine.cs`, `Services/RouteRiskEngine.cs`, `Services/ActivityRiskStrategy.cs` (strategies + shared helpers), `Services/RiskScoring.cs`
- Test: `tests/WeatherRoute.Domain.Tests/RouteRiskEngineTests.cs`

**Interfaces:**
- Consumes: `WeatherSnapshot`, `RouteSegment`, `ActivityType`, `RiskLevel` (Tasks 2–3), `RiskFactor`/`RiskAssessment` (Task 8).
- Produces:
  - `IRouteRiskEngine.Assess(ActivityType activity, IReadOnlyList<WeatherSnapshot> snapshots)` → `RiskAssessment`.
  - `RouteRiskEngine : IRouteRiskEngine` — Strategy per activity; scoring `score = clamp(100 - sumContribution, 0, 100)`; level by score: `>=76 Low, >=51 Moderate, >=26 High, else Severe`; factor `Level` by contribution: `<15 Low, <30 Moderate, <50 High, else Severe`.

- [ ] **Step 1: Write failing tests**

`tests/WeatherRoute.Domain.Tests/RouteRiskEngineTests.cs`:
```csharp
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class RouteRiskEngineTests
{
    private static WeatherSnapshot Clear() =>
        new(new Temperature(20), new Wind(8), 5, 4, 4, WeatherCondition.Clear);

    private static WeatherSnapshot Stormy(double wind = 50) =>
        new(new Temperature(24), new Wind(wind), 90, 3, 2, WeatherCondition.Storm);

    [Fact]
    public void Cycling_Clear_Is_Low_Score_100()
    {
        var engine = new RouteRiskEngine();
        var assessment = engine.Assess(ActivityType.Cycling, new[] { Clear() });

        Assert.Equal(RiskLevel.Low, assessment.Level);
        Assert.Equal(100, assessment.Score);
        Assert.Empty(assessment.Factors);
    }

    [Fact]
    public void Cycling_Strong_Wind_Yields_Wind_Factor_And_Reduced_Score()
    {
        var engine = new RouteRiskEngine();
        var assessment = engine.Assess(ActivityType.Cycling,
            new[] { new WeatherSnapshot(new Temperature(24), new Wind(42), 5, 3, 4, WeatherCondition.Clear) });

        Assert.True(assessment.Score < 100);
        Assert.Contains(assessment.Factors, f => f.Type == "WIND" && f.Contribution == 55); // wind 42 → 55, score 45 → High
        Assert.True(assessment.Level is RiskLevel.High or RiskLevel.Severe);
    }

    [Fact]
    public void Driving_Storm_Is_Severe()
    {
        var engine = new RouteRiskEngine();
        var assessment = engine.Assess(ActivityType.Driving, new[] { Stormy() });

        Assert.Equal(RiskLevel.Severe, assessment.Level);
        Assert.Contains(assessment.Factors, f => f.Type == "STORM");
    }

    [Fact]
    public void Aggregates_Worst_Across_Segments()
    {
        var engine = new RouteRiskEngine();
        var snapshots = new[] { Clear(), Stormy() };

        var assessment = engine.Assess(ActivityType.Motorcycle, snapshots);

        Assert.True(assessment.Score < 60);
        Assert.Equal("MODERATE", assessment.Factors.First(f => f.Type == "WIND").Level);
    }
}
```

- [ ] **Step 2: Run to verify fail**

Run: `dotnet test tests/WeatherRoute.Domain.Tests`
Expected: FAIL (`RouteRiskEngine` missing).

- [ ] **Step 3: Implement scoring + strategies**

```csharp
// Services/RiskScoring.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public static class RiskScoring
{
    public const int Max = 100;

    public static RiskLevel LevelFromScore(int score) => score switch
    {
        >= 76 => RiskLevel.Low,
        >= 51 => RiskLevel.Moderate,
        >= 26 => RiskLevel.High,
        _ => RiskLevel.Severe
    };

    public static string FactorLevel(int contribution) => contribution switch
    {
        < 15 => "LOW",
        < 30 => "MODERATE",
        < 50 => "HIGH",
        _ => "SEVERE"
    };
}
```

```csharp
// Services/IRouteRiskEngine.cs
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public interface IRouteRiskEngine
{
    RiskAssessment Assess(ActivityType activity, IReadOnlyList<WeatherSnapshot> snapshots);
}
```

```csharp
// Services/ActivityRiskStrategy.cs
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public interface IActivityRiskStrategy
{
    ActivityType Activity { get; }
    IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots);
}

public sealed record SnapshotSummary(
    double? MeanTemp, double? MaxWind, double? MaxPrecipProb, int? MaxUv,
    double? MinVisibility, bool WorstWasRain, bool WorstWasStorm, bool WorstWasSnow);

public static class SnapshotSummarizer
{
    public static SnapshotSummary Summarize(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var temps = snapshots.Where(s => s.Temperature is not null).Select(s => s.Temperature!.Celsius).ToList();
        var winds = snapshots.Where(s => s.Wind is not null).Select(s => s.Wind!.Kmh).ToList();
        var probs = snapshots.Where(s => s.PrecipitationProbability is not null).Select(s => s.PrecipitationProbability!.Value).ToList();
        var uvs = snapshots.Where(s => s.UvIndex is not null).Select(s => s.UvIndex!.Value).ToList();
        var vis = snapshots.Where(s => s.VisibilityKm is not null).Select(s => s.VisibilityKm!.Value).ToList();
        bool rain = snapshots.Any(s => s.Condition is WeatherCondition.Rain or WeatherCondition.Snow or WeatherCondition.Storm);
        return new SnapshotSummary(
            temps.Count > 0 ? temps.Average() : null,
            winds.Count > 0 ? winds.Max() : null,
            probs.Count > 0 ? probs.Max() : null,
            uvs.Count > 0 ? uvs.Max() : null,
            vis.Count > 0 ? vis.Min() : null,
            rain,
            snapshots.Any(s => s.Condition == WeatherCondition.Storm),
            snapshots.Any(s => s.Condition == WeatherCondition.Snow));
    }
}

public sealed class CyclingStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Cycling;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MaxWind is { } wind and >= 15)
            factors.Add(Wind("WIND", wind switch { < 25 => 12, < 40 => 25, _ => 55 }, wind));
        if (s.MeanTemp is { } t)
        {
            int p = t is < 0 ? 35 : t is < 5 ? 20 : t is < 10 ? 10 : t is > 40 ? 30 : t is > 35 ? 20 : t is > 30 ? 8 : 0;
            if (p > 0) factors.Add(F("TEMPERATURE", p, $"Temperature {t:0.#}°C"));
        }
        if (s.MaxPrecipProb is { } prob and >= 40)
            factors.Add(F("RAIN", prob switch { < 60 => 10, _ => 20 }, $"{prob:0}% precipitation chance"));
        if (s.WorstWasStorm) factors.Add(F("STORM", 40, "Storm expected"));
        if (s.WorstWasRain) factors.Add(F("RAIN", Math.Max(s.MaxPrecipProb is >= 60 ? 20 : 0, 20), "Rain along the route"));
        if (s.MinVisibility is { } vis and < 1) factors.Add(F("VISIBILITY", 15, $"Visibility {vis:0.#} km"));
        if (s.MaxUv is { } uv and > 6) factors.Add(F("UV", uv switch { > 8 => 15, _ => 10 }, $"UV index {uv}"));
        return Merge(factors);
    }

    public static List<RiskFactor> Merge(IEnumerable<RiskFactor> raw) =>
        raw.GroupBy(f => f.Type)
           .Select(g => g.OrderByDescending(f => f.Contribution).First())
           .ToList();

    public static RiskFactor F(string type, int contribution, string message) =>
        new(type, RiskScoring.FactorLevel(contribution), contribution, message);

    public static RiskFactor Wind(string type, int contribution, double kmh) =>
        new(type, RiskScoring.FactorLevel(contribution), contribution, $"Wind {kmh:0} km/h");
}

public sealed class DrivingStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Driving;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MaxWind is { } wind and >= 45) factors.Add(CyclingStrategy.Wind("WIND", 30, wind));
        if (s.WorstWasStorm) factors.Add(CyclingStrategy.F("STORM", 45, "Storm expected"));
        if (s.WorstWasSnow) factors.Add(CyclingStrategy.F("SNOW", 30, "Snow expected"));
        if (s.WorstWasRain) factors.Add(CyclingStrategy.F("RAIN", 25, "Rain along the route"));
        if (s.MinVisibility is { } vis and < 1) factors.Add(CyclingStrategy.F("VISIBILITY", 25, $"Visibility {vis:0.#} km"));
        return CyclingStrategy.Merge(factors);
    }
}

public sealed class RunningStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Running;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MeanTemp is { } t)
        {
            int p = t is < -5 ? 35 : t < 0 ? 20 : t > 35 ? 25 : t > 30 ? 12 : t > 27 ? 7 : 0;
            if (p > 0) factors.Add(CyclingStrategy.F("HEAT", p, $"Temperature {t:0.#}°C"));
        }
        if (s.MaxWind is { } wind and >= 35) factors.Add(CyclingStrategy.Wind("WIND", 15, wind));
        if (s.WorstWasRain) factors.Add(CyclingStrategy.F("RAIN", 15, "Rain along the route"));
        if (s.MaxUv is { } uv and > 6) factors.Add(CyclingStrategy.F("UV", 10, $"UV index {uv}"));
        return CyclingStrategy.Merge(factors);
    }
}

public sealed class WalkingStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Walking;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MeanTemp is { } t)
        {
            int p = t is < -5 ? 30 : t < 0 ? 15 : t > 38 ? 20 : 0;
            if (p > 0) factors.Add(CyclingStrategy.F("TEMPERATURE", p, $"Temperature {t:0.#}°C"));
        }
        if (s.MaxPrecipProb is { } prob and >= 50) factors.Add(CyclingStrategy.F("RAIN", 10, $"{prob:0}% precipitation chance"));
        if (s.WorstWasStorm) factors.Add(CyclingStrategy.F("STORM", 35, "Storm expected"));
        if (s.MaxUv is { } uv and > 7) factors.Add(CyclingStrategy.F("UV", 8, $"UV index {uv}"));
        if (s.MaxWind is { } wind and >= 45) factors.Add(CyclingStrategy.Wind("WIND", 8, wind));
        return CyclingStrategy.Merge(factors);
    }
}

public sealed class MotorcycleStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Motorcycle;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MaxWind is { } wind and >= 35) factors.Add(CyclingStrategy.Wind("WIND", 20, wind));
        if (s.WorstWasStorm) factors.Add(CyclingStrategy.F("STORM", 40, "Storm expected"));
        if (s.WorstWasRain) factors.Add(CyclingStrategy.F("RAIN", 30, "Rain along the route"));
        if (s.MinVisibility is { } vis and < 2) factors.Add(CyclingStrategy.F("VISIBILITY", 15, $"Visibility {vis:0.#} km"));
        if (s.MeanTemp is { } t and (< 5 or > 35)) factors.Add(CyclingStrategy.F("TEMPERATURE", 15, $"Temperature {t:0.#}°C"));
        return CyclingStrategy.Merge(factors);
    }
}
```

```csharp
// Services/RouteRiskEngine.cs
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public sealed class RouteRiskEngine : IRouteRiskEngine
{
    private readonly IReadOnlyDictionary<ActivityType, IActivityRiskStrategy> _strategies =
        new IActivityRiskStrategy[]
        {
            new CyclingStrategy(), new DrivingStrategy(), new RunningStrategy(),
            new WalkingStrategy(), new MotorcycleStrategy()
        }.ToDictionary(s => s.Activity);

    public RiskAssessment Assess(ActivityType activity, IReadOnlyList<WeatherSnapshot> snapshots)
    {
        if (!_strategies.TryGetValue(activity, out var strategy))
            return new RiskAssessment(RiskLevel.Low, RiskScoring.Max, Array.Empty<RiskFactor>());

        var factors = strategy.Evaluate(snapshots);
        var total = factors.Sum(f => f.Contribution);
        var score = Math.Clamp(RiskScoring.Max - total, 0, RiskScoring.Max);
        return new RiskAssessment(RiskScoring.LevelFromScore(score), score, factors);
    }
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `dotnet test tests/WeatherRoute.Domain.Tests`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend tests
git commit -m "feat: domain risk engine with per-activity strategies"
```

---

### Task 13: Wire real risk engine into the use case + API

**Files:**
- Create: `backend/WeatherRoute.Application/Services/RouteRiskAssessmentService.cs`
- Modify: `backend/WeatherRoute.Api/Program.cs` (re-register risk service, remove `DefaultRiskService`)
- Modify: `tests/WeatherRoute.Application.Tests/CalculateRouteUseCaseTests.cs` (use real engine)

**Interfaces:**
- Consumes: `IRiskAssessmentService` (Task 8), `IRouteRiskEngine` (Task 12).
- Produces: `RouteRiskAssessmentService : IRiskAssessmentService` delegating `Assess(Route route)` → `engine.Assess(route.Activity, route.Segments.Where(s => s.HasWeather).Select(s => s.Weather!).ToList())`.

- [ ] **Step 1: Write service + failing test through use case**

`backend/WeatherRoute.Application/Services/RouteRiskAssessmentService.cs`:
```csharp
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Services;

public sealed class RouteRiskAssessmentService : IRiskAssessmentService
{
    private readonly IRouteRiskEngine _engine;

    public RouteRiskAssessmentService(IRouteRiskEngine engine) => _engine = engine;

    public RiskAssessment Assess(Route route)
    {
        var snapshots = route.Segments.Where(s => s.HasWeather).Select(s => s.Weather!).ToList();
        return snapshots.Count == 0
            ? new RiskAssessment(Domain.Enums.RiskLevel.Low, 100, Array.Empty<RiskFactor>())
            : _engine.Assess(route.Activity, snapshots);
    }
}
```

Update `CalculateRouteUseCaseTests.Build` to pass `new RouteRiskAssessmentService(new RouteRiskEngine())` instead of `DefaultRiskService`, and add one behavioral test:
```csharp
[Fact]
public async Task Risk_Is_Computed_From_Weather()
{
    var useCase = Build(new FakeWeather());
    var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
        "Ciudad Real", "Almagro", ActivityType.Cycling,
        new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), null));

    Assert.All(result.Routes, r =>
    {
        Assert.InRange(r.RiskScore, 0, 100);
        Assert.NotEmpty(r.Factors); // FakeWeather wind 30 → Cycling WIND factor (+25) → score 75
    });
}
```

`FakeWeather` returns 27°C/wind 30/clear — under the Cycling strategy that yields a single WIND factor of 25, so `RiskScore == 75` (`InRange(0,100)` holds) and `Factors` is non-empty.

- [ ] **Step 2: Run tests**

Run: `dotnet test tests/WeatherRoute.Application.Tests`
Expected: PASS (real engine now used).

- [ ] **Step 3: Update Program.cs DI**

Replace the `builder.Services.AddTransient<IRiskAssessmentService, DefaultRiskService>();` line with:
```csharp
builder.Services.AddSingleton<WeatherRoute.Domain.Services.IRouteRiskEngine, WeatherRoute.Domain.Services.RouteRiskEngine>();
builder.Services.AddTransient<IRiskAssessmentService, RouteRiskAssessmentService>();
```
Add `using WeatherRoute.Domain.Services;` and drop the `DefaultRiskService` using/type reference.

- [ ] **Step 4: Run full suite**

Run: `dotnet test backend/WeatherRoute.sln`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend tests
git commit -m "feat: wire domain risk engine into use case and DI"
```

---

### Task 14: PostgreSQL persistence + anonymous analysis endpoint

**Files:**
- Create: `backend/WeatherRoute.Infrastructure/Persistence/Analysis.cs`, `Persistence/AppDbContext.cs`, `Persistence/AnalysisRepository.cs`, `Persistence/ServiceCollectionExtensions.cs`
- Create: `backend/WeatherRoute.Api/Requests/SaveAnalysisRequest.cs`
- Modify: `backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj` (EF + Npgsql), `backend/WeatherRoute.Api/Program.cs`, `backend/WeatherRoute.Api/Endpoints/RouteEndpoints.cs`
- Create: `tests/WeatherRoute.Api.IntegrationTests/AnalysisPersistenceTests.cs` (+ Testcontainers packages)
- Test: repository unit test via in-memory EF? Use real Postgres via Testcontainers (Category=Integration).

**Interfaces:**
- Produces: `Analysis` entity (Id, Origin, Destination, OriginLat, OriginLon, DestLat, DestLon, Activity, DepartureUtc, DistanceKm, DurationMinutes, RiskScore, RiskLevel, CreatedAtUtc); `AppDbContext : DbContext`; `AnalysisRepository : IAnalysisRepository`; EF migration `InitialCreate`; endpoint `POST /api/routes/analyses` → 201 + id; `Database.Migrate()` on startup.

- [ ] **Step 1: Add packages**

`backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj`:
```xml
    <PackageReference Include="Microsoft.EntityFrameworkCore.Relational" Version="10.0.*" />
    <PackageReference Include="Npgsql.EntityFrameworkCore.PostgreSQL" Version="10.0.*" />
```

- [ ] **Step 2: Entity + DbContext + repository**

```csharp
// Persistence/Analysis.cs
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Infrastructure.Persistence;

public sealed class Analysis
{
    public Guid Id { get; set; }
    public string Origin { get; set; } = "";
    public string Destination { get; set; } = "";
    public double OriginLat { get; set; }
    public double OriginLon { get; set; }
    public double DestLat { get; set; }
    public double DestLon { get; set; }
    public ActivityType Activity { get; set; }
    public DateTime DepartureUtc { get; set; }
    public double DistanceKm { get; set; }
    public int DurationMinutes { get; set; }
    public int RiskScore { get; set; }
    public RiskLevel RiskLevel { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}
```

```csharp
// Persistence/AppDbContext.cs
using Microsoft.EntityFrameworkCore;

namespace WeatherRoute.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Analysis> Analyses => Set<Analysis>();
}
```

```csharp
// Persistence/AnalysisRepository.cs
using Microsoft.EntityFrameworkCore;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;

namespace WeatherRoute.Infrastructure.Persistence;

public sealed class AnalysisRepository : IAnalysisRepository
{
    private readonly AppDbContext _db;

    public AnalysisRepository(AppDbContext db) => _db = db;

    public async Task<Guid> SaveAsync(RouteAnalysisRecord record, CancellationToken ct = default)
    {
        var entity = new Analysis
        {
            Id = record.Id,
            Origin = record.Origin,
            Destination = record.Destination,
            OriginLat = record.OriginCoordinates.Latitude,
            OriginLon = record.OriginCoordinates.Longitude,
            DestLat = record.DestinationCoordinates.Latitude,
            DestLon = record.DestinationCoordinates.Longitude,
            Activity = record.Activity,
            DepartureUtc = record.DepartureUtc,
            DistanceKm = record.DistanceKm,
            DurationMinutes = record.DurationMinutes,
            RiskScore = record.RiskScore,
            RiskLevel = record.RiskLevel,
            CreatedAtUtc = record.CreatedAtUtc
        };
        _db.Analyses.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity.Id;
    }

    public async Task<int> CountAsync(CancellationToken ct = default) =>
        await _db.Analyses.CountAsync(ct);
}
```

```csharp
// Persistence/ServiceCollectionExtensions.cs
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace WeatherRoute.Infrastructure.Persistence;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWeatherRoutePersistence(this IServiceCollection services, IConfiguration config)
    {
        var connection = config.GetConnectionString("DefaultConnection")!;
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection));
        services.AddScoped<Application.Ports.Out.IAnalysisRepository, AnalysisRepository>();
        return services;
    }
}
```

- [ ] **Step 3: EF migration**

```bash
dotnet tool install --global dotnet-ef
dotnet ef migrations add InitialCreate -p backend/WeatherRoute.Infrastructure -s backend/WeatherRoute.Api
```

Expected: `backend/WeatherRoute.Infrastructure/Migrations/*` generated.

- [ ] **Step 4: Endpoint + Program wiring**

`backend/WeatherRoute.Api/Requests/SaveAnalysisRequest.cs`:
```csharp
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.Requests;

public sealed record SaveAnalysisRequest(
    string Origin,
    string Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    double DistanceKm,
    int DurationMinutes,
    int RiskScore,
    RiskLevel RiskLevel);
```

In `RouteEndpoints.cs` add (inside the `/api` group):
```csharp
group.MapPost("/routes/analyses", async (
    SaveAnalysisRequest request,
    IAnalysisRepository repository,
    CancellationToken ct) =>
{
    var record = new RouteAnalysisRecord(
        Guid.NewGuid(), request.Origin, request.Destination,
        new Coordinates(0, 0), new Coordinates(0, 0),
        request.Activity,
        request.DepartureTime.Kind == DateTimeKind.Utc ? request.DepartureTime : DateTime.SpecifyKind(request.DepartureTime, DateTimeKind.Utc),
        request.DistanceKm, request.DurationMinutes, request.RiskScore, request.RiskLevel,
        DateTime.UtcNow);
    var id = await repository.SaveAsync(record, ct);
    return Results.Created($"/api/routes/analyses/{id}", new { id });
});
```
Add the `using WeatherRoute.Application.Dtos;` (already present) and `using WeatherRoute.Infrastructure.Persistence;` at top of `RouteEndpoints.cs`.

In `Program.cs`, after DI setup:
```csharp
using WeatherRoute.Infrastructure.Persistence;
builder.Services.AddWeatherRoutePersistence(builder.Configuration);
```
And after `app.Build()` add migration on startup (gated so hosts without Postgres — e.g. unit smoke tests — still boot):
```csharp
if (builder.Configuration.GetValue<bool>("Persistence:AutoMigrate", true))
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Database migration skipped.");
    }
}
```

Update `ApiSmokeTests` (from Task 9) so they don't need Postgres:
```csharp
using Microsoft.AspNetCore.Hosting;
...
public ApiSmokeTests(WebApplicationFactory<Program> factory) =>
    _factory = factory.WithWebHostBuilder(b => b.UseSetting("Persistence:AutoMigrate", "false"));
```
`AnalysisPersistenceTests` (Task 14) keeps `AutoMigrate` default true and points `ConnectionStrings:DefaultConnection` at the Testcontainer.

- [ ] **Step 5: Integration test (Testcontainers)**

`tests/WeatherRoute.Api.IntegrationTests/WeatherRoute.Api.IntegrationTests.csproj` — add:
```xml
    <PackageReference Include="Testcontainers.PostgreSql" Version="4.*" />
```

`tests/WeatherRoute.Api.IntegrationTests/AnalysisPersistenceTests.cs`:
```csharp
using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Testcontainers.PostgreSql;

namespace WeatherRoute.Api.IntegrationTests;

public sealed class AnalysisPersistenceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder()
        .WithDatabase("weatherroute")
        .WithUsername("weatherroute")
        .WithPassword("weatherroute")
        .Build();

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Saves_Anonymous_Analysis()
    {
        using var app = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b => b.UseSetting("ConnectionStrings:DefaultConnection", _postgres.GetConnectionString()));
        using var client = app.CreateClient();

        var response = await client.PostAsJsonAsync("/api/routes/analyses", new
        {
            origin = "Ciudad Real",
            destination = "Almagro",
            activity = "Cycling",
            departureTime = "2026-09-27T08:00:00Z",
            distanceKm = 74.2,
            durationMinutes = 168,
            riskScore = 88,
            riskLevel = "Low"
        });

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        var body = await response.Content.ReadFromJsonAsync<JsonElementWrapper>();
        Assert.NotEqual(Guid.Empty, body.Id);
    }

    public Task InitializeAsync() => _postgres.StartAsync();
    public Task DisposeAsync() => _postgres.StopAsync();
}

internal sealed class JsonElementWrapper
{
    public Guid Id { get; set; }
}
```

Note: `WebApplicationFactory` migration call runs against the containerized Postgres.

- [ ] **Step 6: Run tests**

Run: `dotnet test tests/WeatherRoute.Api.IntegrationTests --filter Category=Integration`
Expected: PASS (Docker running).

- [ ] **Step 7: Commit**

```bash
git add backend tests
git commit -m "feat: PostgreSQL persistence for anonymous analyses"
```

---

### Task 15: Redis caching decorator with in-memory fallback

**Files:**
- Create: `backend/WeatherRoute.Infrastructure/Caching/CachedCalculateRouteUseCase.cs`, `Caching/CachingOptions.cs`
- Modify: `backend/WeatherRoute.Api/Program.cs` (register `IDistributedCache` provider + decorator), `appsettings.json`
- Test: `tests/WeatherRoute.Infrastructure.Tests/CachedCalculateRouteUseCaseTests.cs`

**Interfaces:**
- Consumes: `ICalculateRouteUseCase`, `CalculateRouteCommand`, `RouteAnalysisResponse` (Task 8).
- Produces: `CachedCalculateRouteUseCase(ICalculateRouteUseCase inner, IDistributedCache cache, CachingOptions options)` replacing null `RouteAnalysisResponse` handling; key `route-analysis:{sha256(origin|dest|activity|departureUtc:o)}`; TTL `max(60s, min(6h, nextHour - now))`; JSON (de)serialization with `JsonStringEnumConverter`.
- DI: provider = Redis if `ConnectionStrings:Redis` set, else in-memory; decorator wraps real use case only when `CachingOptions:Provider=Redis`.

- [ ] **Step 1: Write failing tests**

`tests/WeatherRoute.Infrastructure.Tests/CachedCalculateRouteUseCaseTests.cs`:
```csharp
using Microsoft.Extensions.Caching.Memory;
using System.Text.Json;
using System.Text.Json.Serialization;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Infrastructure.Caching;
using Xunit;

namespace WeatherRoute.Infrastructure.Tests;

public class CachedCalculateRouteUseCaseTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, Converters = { new JsonStringEnumConverter() } };
    private static readonly CachingOptions Options = new();

    [Fact]
    public async Task Second_Call_Skips_Inner()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, "r",
                new[] { new RouteCandidate("p", 74, 168, RiskLevel.Low, 88, Array.Empty<RiskFactor>(), Array.Empty<SegmentResult>(), Array.Empty<Coordinates>()) });
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new MemoryDistributedCache(new MemoryDistributedCacheOptions()), Options, Json);
        var command = new CalculateRouteCommand("A", "B", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        await useCase.ExecuteAsync(command);
        await useCase.ExecuteAsync(command);

        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task Different_Commands_Are_Not_Cached_Together()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, null, Array.Empty<RouteCandidate>());
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new MemoryDistributedCache(new MemoryDistributedCacheOptions()), Options, Json);

        await useCase.ExecuteAsync(new CalculateRouteCommand("A", "B", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc)));
        await useCase.ExecuteAsync(new CalculateRouteCommand("B", "A", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc)));

        Assert.Equal(2, calls);
    }

    private sealed class FakeInner(Func<RouteAnalysisResponse> factory) : ICalculateRouteUseCase
    {
        public Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default) =>
            Task.FromResult(factory());
    }
}
```

The tests reference `MemoryDistributedCache` from `Microsoft.Extensions.Caching.Memory` (in that package), and `RiskFactor`/`SegmentResult`/`Coordinates` — add the needed usings at top:
```csharp
using Microsoft.Extensions.Caching.Distributed;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;
```

Reference note: `SegmentResult` and `Coordinates` may be unused warnings under TreatWarningsAsErrors — remove unused usings except the ones needed (RiskFactor is Domain.Services; Coordinates is Domain.ValueObjects; SegmentResult is Application.Dtos). Keep only those actually referenced in the file (RiskFactor and Coordinates and SegmentResult all appear). `ActivityType` used. Good.

- [ ] **Step 2: Run to verify fail**

Run: `dotnet test tests/WeatherRoute.Infrastructure.Tests`
Expected: FAIL.

- [ ] **Step 3: Implement decorator**

```csharp
// Caching/CachingOptions.cs
namespace WeatherRoute.Infrastructure.Caching;

public sealed class CachingOptions
{
    public string Provider { get; set; } = "InMemory";
    public TimeSpan? OverrideTtl { get; set; }
}
```

```csharp
// Caching/CachedCalculateRouteUseCase.cs
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Distributed;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;

namespace WeatherRoute.Infrastructure.Caching;

public sealed class CachedCalculateRouteUseCase : ICalculateRouteUseCase
{
    private readonly ICalculateRouteUseCase _inner;
    private readonly IDistributedCache _cache;
    private readonly CachingOptions _options;
    private readonly JsonSerializerOptions _json;

    public CachedCalculateRouteUseCase(
        ICalculateRouteUseCase inner,
        IDistributedCache cache,
        CachingOptions options,
        JsonSerializerOptions? json = null)
    {
        _inner = inner;
        _cache = cache;
        _options = options;
        _json = json ?? new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };
    }

    public async Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default)
    {
        string key = BuildKey(command);
        var cached = await _cache.GetAsync(key, ct);
        if (cached is not null)
            return JsonSerializer.Deserialize<RouteAnalysisResponse>(cached, _json)!;

        var result = await _inner.ExecuteAsync(command, ct);
        await _cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(result, _json), Ttl(), ct);
        return result;
    }

    public static string BuildKey(CalculateRouteCommand command)
    {
        var raw = $"{command.Origin.ToLowerInvariant()}|{command.Destination.ToLowerInvariant()}|{command.Activity}|{command.DepartureTimeUtc:o}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
        return $"route-analysis:{hash}";
    }

    private DistributedCacheEntryOptions Ttl()
    {
        if (_options.OverrideTtl is { } fixedTtl)
            return new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = fixedTtl };

        var now = DateTimeOffset.UtcNow;
        var nextHour = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour + 1, 0, 0, TimeSpan.Zero);
        var ttl = nextHour - now;
        if (ttl < TimeSpan.FromSeconds(60)) ttl = TimeSpan.FromSeconds(60);
        if (ttl > TimeSpan.FromHours(6)) ttl = TimeSpan.FromHours(6);
        return new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = ttl };
    }
}
```

- [ ] **Step 4: Register in Program.cs + appsettings**

Add to `appsettings.json` (merge the Redis line with the existing `DefaultConnection` from Task 14):
```json
  "ConnectionStrings": {
    "DefaultConnection": "Host=localhost;Database=weatherroute;Username=weatherroute;Password=weatherroute",
    "Redis": "localhost:6379"
  },
  "CachingOptions": {
    "Provider": "Redis"
  },
```
and `appsettings.Development.json` with `"CachingOptions": { "Provider": "InMemory" }`.

Add to `backend/WeatherRoute.Api/WeatherRoute.Api.csproj`:
```xml
    <PackageReference Include="Microsoft.Extensions.Caching.Memory" Version="10.0.*" />
    <PackageReference Include="Microsoft.Extensions.Caching.StackExchangeRedis" Version="10.0.*" />
```

In `Program.cs` (single geocoder from Task 8 already; register the concrete use case, then the interface via a factory that wraps it in the decorator):
```csharp
using WeatherRoute.Infrastructure.Caching;

var redis = builder.Configuration.GetConnectionString("Redis");
if (string.IsNullOrWhiteSpace(redis))
    builder.Services.AddDistributedMemoryCache();
else
    builder.Services.AddStackExchangeRedisCache(o => o.Configuration = redis);

builder.Services.AddScoped<WeatherRoute.Application.UseCases.CalculateRouteUseCase>();
builder.Services.AddScoped<ICalculateRouteUseCase>(sp =>
{
    var inner = sp.GetRequiredService<WeatherRoute.Application.UseCases.CalculateRouteUseCase>();
    var cache = sp.GetRequiredService<Microsoft.Extensions.Caching.Distributed.IDistributedCache>();
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<CachingOptions>>().Value;
    return string.Equals(options.Provider, "Redis", StringComparison.OrdinalIgnoreCase)
        ? new CachedCalculateRouteUseCase(inner, cache, options)
        : inner;
});
```
Any code that depends on `ICalculateRouteUseCase` (the API endpoint) now receives the decorator; the 5-arg `CalculateRouteUseCase` ctor `(IGeocodingProvider, IRouteProvider, IWeatherProvider, IRouteSampler, IRiskAssessmentService)` resolves via DI (single `IGeocodingProvider` singleton, single `IWeatherProvider` registration).

- [ ] **Step 5: Run tests**

Run: `dotnet test backend/WeatherRoute.sln`
Expected: PASS. Confirm Application/Infrastructure unit tests pass with `Provider=InMemory` (config default is `InMemory`).

```bash
git add backend tests
git commit -m "feat: Redis/distributed caching decorator with in-memory fallback"
```

---

### Task 16: Resilience, health checks, OpenTelemetry

**Files:**
- Modify: `backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj` (resilience package), `backend/WeatherRoute.Api/WeatherRoute.Api.csproj` (OpenTelemetry packages), `backend/WeatherRoute.Api/Program.cs`, `appsettings.json`
- Create: `backend/WeatherRoute.Infrastructure/Resilience/ResilienceExtensions.cs`, `backend/WeatherRoute.Api/Telemetry/Metrics.cs`
- Test: contract tests `tests/WeatherRoute.Infrastructure.Tests/AdaptersContractTests.cs` (live APIs, `[Trait("Category", "Integration")]`)

**Interfaces:**
- Produces resistance: `AddWeatherRouteResilience(IServiceCollection, IConfiguration)` wiring retry/timeout/circuit-breaker for typed "ors" + Open-Meteo clients; health endpoints `/health`, `/health/ready`; metrics `route_calculation_duration` (histogram) recorded in `Metrics` helper; OTLP console exporter.

- [ ] **Step 1: Add packages**

`backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj`:
```xml
    <PackageReference Include="Microsoft.Extensions.Http.Resilience" Version="10.0.*" />
```

`backend/WeatherRoute.Api/WeatherRoute.Api.csproj`:
```xml
    <PackageReference Include="OpenTelemetry.Exporter.Console" Version="1.11.*" />
    <PackageReference Include="OpenTelemetry.Extensions.Hosting" Version="1.11.*" />
    <PackageReference Include="OpenTelemetry.Instrumentation.AspNetCore" Version="1.11.*" />
    <PackageReference Include="OpenTelemetry.Instrumentation.Http" Version="1.11.*" />
```

- [ ] **Step 2: Resilience extension**

`backend/WeatherRoute.Infrastructure/Resilience/ResilienceExtensions.cs`:
```csharp
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Logging;

namespace WeatherRoute.Infrastructure.Resilience;

public static class ResilienceExtensions
{
    public static IServiceCollection AddWeatherRouteResilience(this IServiceCollection services)
    {
        services.AddHttpClient("ors")
            .AddResilienceHandler("ors-policy", b =>
            {
                b.AddRetry(new HttpRetryStrategyOptions { MaxRetryAttempts = 3, BackoffType = DelayBackoffType.Exponential });
                b.AddTimeout(TimeSpan.FromSeconds(15));
                b.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
                {
                    SamplingDuration = TimeSpan.FromSeconds(30),
                    FailureRatio = 0.5,
                    MinimumThroughput = 5,
                    BreakDuration = TimeSpan.FromSeconds(20)
                });
            });

        services.AddHttpClient("open-meteo")
            .AddResilienceHandler("weather-policy", b =>
            {
                b.AddRetry(new HttpRetryStrategyOptions { MaxRetryAttempts = 2 });
                b.AddTimeout(TimeSpan.FromSeconds(15));
            });

        return services;
    }
}
```

- [ ] **Step 3: Metrics helper**

`backend/WeatherRoute.Application/Telemetry/Metrics.cs` (must live in Application so `CalculateRouteUseCase` can record without Api reference — layering; namespace `WeatherRoute.Application.Telemetry`):
```csharp
using System.Diagnostics.Metrics;

namespace WeatherRoute.Application.Telemetry;

public static class Metrics
{
    public const string MeterName = "WeatherRoute.Api";

    public static readonly Meter Meter = new(MeterName, "1.0.0");
    public static readonly Histogram<double> CoreApiDuration = Meter.CreateHistogram<double>("route_calculation_duration", "ms");
    public static readonly Histogram<double> WeatherApiDuration = Meter.CreateHistogram<double>("weather_api_duration", "ms");
    public static readonly Counter<long> RouteProviderErrors = Meter.CreateCounter<long>("route_provider_errors");
    public static readonly Counter<long> WeatherProviderErrors = Meter.CreateCounter<long>("weather_provider_errors");
}
```

Instrument the weather loop in `CalculateRouteUseCase`:
```csharp
var sw = Stopwatch.GetTimestamp();
try { weather = await _weather.GetForecastAsync(midpoint, arrivalUtc, ct); }
catch (Exception ex) when (ex is not OperationCanceledException)
{ WeatherProviderErrors.Add(1); weather = null; }
WeatherApiDuration.Record(Stopwatch.GetElapsedTime(sw).TotalMilliseconds);
```
Wrap the whole `ExecuteAsync` duration with `CoreApiDuration.Record(...)` in a try/catch rethrow-free way (record in `finally` when route ran). Add `using WeatherRoute.Application.Telemetry;` to the use case.

- [ ] **Step 4: Program.cs OpenTelemetry + health**

Add in `Program.cs`:
```csharp
using OpenTelemetry.Metrics;
using WeatherRoute.Infrastructure.Resilience;
builder.Services.AddWeatherRouteResilience();

builder.Services.AddOpenTelemetry()
    .WithMetrics(m =>
    {
        m.AddMeter(Metrics.MeterName);
        m.AddAspNetCoreInstrumentation();
        m.AddHttpClientInstrumentation();
        m.AddConsoleExporter();
    });

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("postgres", tags: ["ready"]);
```
Map endpoints — **replace** the simple `app.MapGet("/health", () => Results.Ok(...))` from Task 9 with:
```csharp
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });                         // liveness
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = r => r.Tags.Contains("ready") }); // readiness
```
Add `using Microsoft.Extensions.Diagnostics.HealthChecks;`, `using OpenTelemetry.Metrics;`, and `using WeatherRoute.Application.Telemetry;` at top of `Program.cs` (`AppDbContext`/`AddDbContextCheck` need `using WeatherRoute.Infrastructure.Persistence;` and `using Microsoft.EntityFrameworkCore;`).

**Route the Open-Meteo adapter through the resilient named client.** In `Program.cs`, replace the Task 13 `AddTransient<IWeatherProvider>(_ => new OpenMeteoWeatherAdapter(new HttpClient { BaseAddress = ... }))` with:
```csharp
builder.Services.AddTransient<IWeatherProvider>(sp =>
{
    var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient("open-meteo");
    http.BaseAddress = new Uri("https://api.open-meteo.com");
    return new OpenMeteoWeatherAdapter(http);
});
```
and keep the ORS adapter registered as before (it needs the `Authorization` header at request time).

- [ ] **Step 5: Contract tests (live adapters)**

`tests/WeatherRoute.Infrastructure.Tests/AdaptersContractTests.cs`:
```csharp
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Routing;
using WeatherRoute.Infrastructure.Weather;

namespace WeatherRoute.Infrastructure.Tests;

public class AdaptersContractTests : IAsyncLifetime
{
    private readonly HttpClient _http = new();

    [Fact]
    [Trait("Category", "Integration")]
    public async Task OpenMeteo_Returns_Forecast_For_Madrid()
    {
        var adapter = new OpenMeteoWeatherAdapter(_http);

        var weather = await adapter.GetForecastAsync(new Coordinates(40.42, -3.70),
            DateTime.UtcNow.Date.AddHours(9));

        Assert.NotNull(weather);
        Assert.InRange(weather!.TemperatureC!.Value, -20, 50);
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task OpenRouteService_Geocodes_Ciudad_Real()
    {
        var key = Environment.GetEnvironmentVariable("OPENROUTESERVICE_API_KEY");
        if (string.IsNullOrEmpty(key)) return; // CI without secret: skip
        var adapter = new OpenRouteServiceRoutingAdapter(_http,
            new OpenRouteServiceOptions { BaseUrl = "https://api.openrouteservice.org", ApiKey = key });

        var coord = await ((IGeocodingProvider)adapter).GeocodeAsync("Ciudad Real");

        Assert.InRange(coord.Latitude, 38, 39.5);
        Assert.InRange(coord.Longitude, -4.5, -3.5);
    }

    public Task InitializeAsync() => Task.CompletedTask;
    public async Task DisposeAsync()
    {
        _http.Dispose();
        await Task.CompletedTask;
    }
}
```

- [ ] **Step 6: Run tests**

Run: `dotnet test backend/WeatherRoute.sln --filter "Category!=Integration"` then `dotnet test ... --filter "Category=Integration"` (requires key for ORS; Open-Meteo contract runs with network).
Also run `dotnet build backend/WeatherRoute.sln -warnaserror`.

- [ ] **Step 7: Commit**

```bash
git add backend tests
git commit -m "feat: resilience policies, health checks, OpenTelemetry metrics"
```

---
### Task 17: Frontend — comparison, risk breakdown, weather timeline

**Files:**
- Modify: `frontend/src/components/RouteResults.tsx` (add comparison + timeline + factors)
- Create: `frontend/src/components/ComparisonTable.tsx`, `frontend/src/components/WeatherTimeline.tsx`, `frontend/src/components/RiskBreakdown.tsx`
- Test: `frontend/src/components/RiskBreakdown.test.tsx`

**Interfaces:**
- Consumes: `RouteAnalysisResponse` types (Task 10).
- Produces: per-route risk factor chips ("why 68/100"), A/B/C comparison table, Recharts area/line timeline of temperature + precipitation across segments.

- [ ] **Step 1: Write failing component test**

`frontend/src/components/RiskBreakdown.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RiskBreakdown from "./RiskBreakdown";

describe("RiskBreakdown", () => {
  it("renders score and factor with contribution", () => {
    render(
      <RiskBreakdown
        score={68}
        level="Moderate"
        factors={[{ type: "WIND", level: "HIGH", contribution: 25, message: "Wind 32 km/h" }]}
      />,
    );
    expect(screen.getByText("68 / 100")).toBeInTheDocument();
    expect(screen.getByText("Wind 32 km/h")).toBeInTheDocument();
    expect(screen.getByText("+25")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/components/RiskBreakdown.test.tsx`
Expected: FAIL (component missing).

- [ ] **Step 3: Implement RiskBreakdown**

`frontend/src/components/RiskBreakdown.tsx`:
```tsx
import type { RiskFactor } from "../types";

interface Props {
  score: number;
  level: string;
  factors: RiskFactor[];
}

export default function RiskBreakdown({ score, level, factors }: Props) {
  return (
    <div className="mt-4 rounded-lg bg-slate-50 p-4">
      <p className="text-2xl font-bold">
        {score} <span className="text-base font-normal text-slate-500">/ 100 · {level}</span>
      </p>
      <ul className="mt-2 space-y-1 text-sm">
        {factors.length === 0 && <li className="text-slate-500">Sin factores de riesgo destacados.</li>}
        {factors.map((f) => (
          <li key={f.type} className="flex items-center justify-between">
            <span>{f.message}</span>
            <span className="font-mono text-slate-600">+{f.contribution}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Implement ComparisonTable**

`frontend/src/components/ComparisonTable.tsx`:
```tsx
import type { RouteCandidate } from "../types";

export default function ComparisonTable({ routes }: { routes: RouteCandidate[] }) {
  const rain = (r: RouteCandidate) =>
    Math.max(...r.segments.map((s) => s.weather?.precipitationProbability ?? 0), 0);
  const wind = (r: RouteCandidate) =>
    Math.max(...r.segments.map((s) => s.weather?.windKmh ?? 0), 0);

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <th className="p-3">#</th>
            <th>Distancia</th>
            <th>Duración</th>
            <th>Lluvia máx.</th>
            <th>Viento máx.</th>
            <th>Riesgo</th>
          </tr>
        </thead>
        <tbody>
          {routes.map((r, i) => (
            <tr key={r.providerId} className="border-b border-slate-100">
              <td className="p-3 font-semibold">{i + 1}</td>
              <td>{r.distanceKm.toFixed(1)} km</td>
              <td>{Math.floor(r.durationMinutes / 60)}h {r.durationMinutes % 60}m</td>
              <td>{rain(r).toFixed(0)}%</td>
              <td>{wind(r).toFixed(0)} km/h</td>
              <td>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${riskBadge(r.riskLevel)}`}>
                  {r.riskLevel} · {r.riskScore}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function riskBadge(level: string): string {
  switch (level) {
    case "Low": return "bg-emerald-100 text-emerald-800";
    case "Moderate": return "bg-amber-100 text-amber-800";
    case "High": return "bg-orange-100 text-orange-800";
    default: return "bg-red-100 text-red-800";
  }
}
```

- [ ] **Step 5: Implement WeatherTimeline**

`frontend/src/components/WeatherTimeline.tsx`:
```tsx
import { Area, AreaChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { RouteCandidate } from "../types";

export default function WeatherTimeline({ route }: { route: RouteCandidate }) {
  const data = route.segments.map((s, i) => ({
    index: `T${i + 1}`,
    hour: s.arrivalTimeUtc
      ? new Date(s.arrivalTimeUtc).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : `T${i + 1}`,
    temp: s.weather?.temperatureC ?? null,
    rain: s.weather?.precipitationProbability ?? null,
  }));

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
          <YAxis hide />
          <Legend />
          <Tooltip />
          <Area type="monotone" name="Temp °C" dataKey="temp" stroke="#2563eb" fill="#dbeafe" />
          <Area type="monotone" name="Lluvia %" dataKey="rain" stroke="#0d9488" fill="#ccfbf1" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 6: Wire into RouteResults**

In `RouteResults.tsx` add imports `ComparisonTable`, `WeatherTimeline`, `RiskBreakdown`. After the recommendation banner render:
```tsx
{result.routes.length > 1 && <ComparisonTable routes={result.routes} />}
```
And inside the per-route `article`, under the table add:
```tsx
<RiskBreakdown score={route.riskScore} level={route.riskLevel} factors={route.factors} />
<WeatherTimeline route={route} />
```

- [ ] **Step 7: Run frontend checks**

Run: `cd frontend && npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend
git commit -m "feat: route comparison, risk breakdown and weather timeline"
```

---

### Task 18: Frontend — MapLibre interactive map

**Files:**
- Create: `frontend/src/components/RouteMap.tsx`
- Modify: `frontend/src/App.tsx`, `frontend/src/components/RouteResults.tsx`, `frontend/src/index.css` (map container height + maplibre css import)

**Interfaces:**
- Consumes: `RouteCandidate` geometry (`polyline: {latitude, longitude}[]`).
- Produces: `<RouteMap routes={routes} />` rendering each route as a GeoJSON line (color by risk) with `fitBounds` to the union; the first route gets an id so CSS urban markers can be added later.

- [ ] **Step 1: Implement RouteMap**

`frontend/src/components/RouteMap.tsx`:
```tsx
import { useEffect, useRef } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { RouteCandidate } from "../types";

const STYLE_URL = "https://tiles.openfreemap.org/styles/liberty";

function toColor(level: string): string {
  switch (level) {
    case "Low": return "#10b981";
    case "Moderate": return "#f59e0b";
    case "High": return "#f97316";
    default: return "#ef4444";
  }
}

export default function RouteMap({ routes }: { routes: RouteCandidate[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: [1.8, 42.6],
      zoom: 5,
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || routes.length === 0) return;

    const source = map.getSource("routes");
    if (source) (map.getSource("routes") as unknown as { setData: (d: unknown) => void }).setData(buildGeoJson(routes));
    else map.addSource("routes", { type: "geojson", data: buildGeoJson(routes) });
    if (!map.getLayer("route-lines")) {
      map.addLayer({
        id: "route-lines",
        type: "line",
        source: "routes",
        paint: {
          "line-color": ["get", "color"],
          "line-width": 4,
          "line-opacity": 0.9,
        },
      });
    }

    const coords = routes.flatMap((r) => r.polyline.map((p) => [p.longitude, p.latitude] as [number, number]));
    if (coords.length > 0) map.fitBounds(coords as unknown as maplibregl.LngLatBoundsLike, { padding: 60 });
  }, [routes]);

  return (
    <div ref={containerRef} className="h-[420px] w-full overflow-hidden rounded-xl border border-slate-200" />
  );
}

function buildGeoJson(routes: RouteCandidate[]) {
  return {
    type: "FeatureCollection",
    features: routes.map((r) => ({
      type: "Feature",
      properties: { color: toColor(r.riskLevel) },
      geometry: {
        type: "LineString",
        coordinates: r.polyline.map((p) => [p.longitude, p.latitude]),
      },
    })),
  };
}
```

- [ ] **Step 2: Wire into RouteResults**

In `RouteResults.tsx` add import and render at the top of the section:
```tsx
<RouteMap routes={result.routes} />
```

- [ ] **Step 3: Run checks**

Run: `cd frontend && npm run typecheck && npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend
git commit -m "feat: MapLibre route map colored by risk"
```

---

### Task 19: Frontend — loading, error and empty states

**Files:**
- Modify: `frontend/src/App.tsx` (persist last values for retry, skeleton while pending, error with retry button)
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `analyzeRoute` (Task 10).
- Produces: `handleRetry` refires last mutation; loading shows skeleton rows; error shows message + "Reintentar" button; empty (no routes) already handled in RouteResults.

- [ ] **Step 1: Write failing test**

`frontend/src/App.test.tsx`:
```tsx
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./App";

afterEach(() => vi.restoreAllMocks());

describe("App", () => {
  it("shows an error message and allows retry when the API fails", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 503 }),
    );
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <App />
      </QueryClientProvider>,
    );

    await userEvent.type(screen.getByLabelText(/desde/i), "Ciudad Real");
    await userEvent.type(screen.getByLabelText(/hasta/i), "Almagro");
    await userEvent.click(screen.getByRole("button", { name: /analizar ruta/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run src/App.test.tsx`
Expected: FAIL (no retry button / no alert role on error).

- [ ] **Step 3: Update App.tsx**

```tsx
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import RouteForm, { type RouteFormValues } from "./components/RouteForm";
import RouteResults from "./components/RouteResults";
import { analyzeRoute } from "./services/api";
import type { AnalyzeRequest, RouteAnalysisResponse } from "./types";

export default function App() {
  const [result, setResult] = useState<RouteAnalysisResponse | null>(null);
  const [last, setLast] = useState<AnalyzeRequest | null>(null);

  const mutation = useMutation({
    mutationFn: analyzeRoute,
    onSuccess: setResult,
  });

  function toRequest(values: RouteFormValues): AnalyzeRequest {
    return {
      ...values,
      departureTime: new Date(values.date + "T" + values.time).toISOString(),
    };
  }

  function handleSubmit(values: RouteFormValues) {
    const request = toRequest(values);
    setLast(request);
    setResult(null);
    mutation.mutate(request);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-3xl font-bold">WeatherRoute</h1>
      <RouteForm onSubmit={handleSubmit} loading={mutation.isPending} />
      {mutation.isPending && (
        <div className="mt-6 grid gap-4 md:grid-cols-2" role="status" aria-label="cargando">
          {[0, 1].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      )}
      {mutation.isError && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4" role="alert">
          <p className="text-red-700">No se pudo calcular la ruta. Revisa tu conexión e inténtalo de nuevo.</p>
          {last && (
            <button
              type="button"
              onClick={() => mutation.mutate(last)}
              className="mt-2 rounded-md bg-red-700 px-3 py-1.5 text-sm font-semibold text-white"
            >
              Reintentar
            </button>
          )}
        </div>
      )}
      {result && <RouteResults result={result} />}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run src/App.test.tsx && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend
git commit -m "feat: loading, error and retry states"
```

---

### Task 20: Docker + Compose (api, frontend, postgres, redis)

**Files:**
- Create: `backend/Dockerfile`, `frontend/Dockerfile`, `frontend/nginx.conf`, `docker-compose.yml`, `.env.example`
- Modify: none (code unchanged).

**Interfaces:**
- Produces: `docker compose up --build` starting postgres, redis, api (port 8080), frontend (port 80). `OPENROUTESERVICE_API_KEY` read from `.env`.

- [ ] **Step 1: backend Dockerfile**

`backend/Dockerfile`:
```dockerfile
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY backend/WeatherRoute.sln ./
COPY backend/Directory.Build.props ./
COPY backend/WeatherRoute.Domain/WeatherRoute.Domain.csproj backend/WeatherRoute.Domain/
COPY backend/WeatherRoute.Application/WeatherRoute.Application.csproj backend/WeatherRoute.Application/
COPY backend/WeatherRoute.Infrastructure/WeatherRoute.Infrastructure.csproj backend/WeatherRoute.Infrastructure/
COPY backend/WeatherRoute.Api/WeatherRoute.Api.csproj backend/WeatherRoute.Api/
RUN dotnet restore backend/WeatherRoute.Api/WeatherRoute.Api.csproj
COPY backend/ ./
RUN dotnet publish backend/WeatherRoute.Api -c Release -o /app/out

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
WORKDIR /app
ENV ASPNETCORE_URLS=http://+:8080
COPY --from=build /app/out ./
EXPOSE 8080
ENTRYPOINT ["dotnet", "WeatherRoute.Api.dll"]
```

- [ ] **Step 2: frontend Dockerfile + nginx**

`frontend/nginx.conf`:
```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api/ {
        proxy_pass http://api:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

`frontend/Dockerfile`:
```dockerfile
FROM node:24-alpine AS build
WORKDIR /app
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM nginx:alpine
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

- [ ] **Step 3: docker-compose.yml**

`docker-compose.yml`:
```yaml
services:
  api:
    build:
      context: .
      dockerfile: backend/Dockerfile
    environment:
      ConnectionStrings__DefaultConnection: Host=postgres;Database=weatherroute;Username=weatherroute;Password=weatherroute
      ConnectionStrings__Redis: redis:6379
      OpenRouteServiceOptions__ApiKey: ${OPENROUTESERVICE_API_KEY:-}
      CachingOptions__Provider: Redis
      Persistence__AutoMigrate: "true"
    ports:
      - "5080:8080"
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_started

  frontend:
    build:
      context: .
      dockerfile: frontend/Dockerfile
    ports:
      - "3000:80"
    depends_on: [api]

  postgres:
    image: postgres:17-alpine
    environment:
      POSTGRES_DB: weatherroute
      POSTGRES_USER: weatherroute
      POSTGRES_PASSWORD: weatherroute
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U weatherroute"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 4: .env.example**

`.env.example`:
```bash
# OpenRouteService free tier key (https://openrouteservice.org)
OPENROUTESERVICE_API_KEY=your-key-here
```

- [ ] **Step 5: Verify compose builds**

Run: `docker compose config` (validates YAML). Optionally `docker compose build` (long, needs network).
Expected: config prints services; build succeeds when run.

- [ ] **Step 6: Commit**

```bash
git add backend/Dockerfile frontend/Dockerfile frontend/nginx.conf docker-compose.yml .env.example
git commit -m "feat: docker compose with api, frontend, postgres, redis"
```

---

### Task 21: README, AGENTS.md, provider keys doc

**Files:**
- Create: `README.md`, `AGENTS.md`, `docs/architecture.md` (short), `docs/adr/0001-provider-choice.md`

**Interfaces:**
- Produces: runnable-from-scratch docs; AGENTS.md with commands/constraints for future sessions.

- [ ] **Step 1: Write README.md**

Cover: what it is, architecture diagram (ASCII), quick start (`docker compose up --build`), local dev (run api `dotnet run --project backend/WeatherRoute.Api`, frontend `npm run dev` in `frontend/`, key setup), test commands, API reference (endpoints + sample payload), tech stack, roadmap status. Keep it 60–100 lines.

- [ ] **Step 2: Write AGENTS.md**

Include: repo layout, build/test/lint commands (`dotnet test backend/WeatherRoute.sln`, `npm run typecheck && npm test && npm run build` in `frontend/`), hexagon layering rule, config env keys, "never commit secrets", provider profile mapping, heading conventions (`feat:`/`test:`/`chore:`), where specs/plans live (`docs/superpowers/`).

- [ ] **Step 3: Write `docs/architecture.md` + `docs/adr/0001-provider-choice.md`**

Architecture: the hexagonal diagram from the spec plus data flow. ADR: why OpenRouteService (free tier, multi-profile, geocoding) + Open-Meteo (free, no key, hourly fields needed) over alternatives.

- [ ] **Step 4: Commit**

```bash
git add README.md AGENTS.md docs
git commit -m "docs: README, AGENTS, architecture and ADR for provider choice"
```

---

### Task 22: Full verification pass

**Files:**
- Modify: as needed from failures.

- [ ] **Step 1: Run the entire backend suite**

Run: `dotnet build backend/WeatherRoute.sln -warnaserror && dotnet test backend/WeatherRoute.sln --filter "Category!=Integration"`
Expected: green.

- [ ] **Step 2: Run frontend suite**

Run: `cd frontend && npm run typecheck && npm test && npm run build`
Expected: green.

- [ ] **Step 3: Run integration tests (Docker required)**

Run: `dotnet test tests/WeatherRoute.Api.IntegrationTests` and `dotnet test tests/WeatherRoute.Infrastructure.Tests --filter "Category=Integration"`
Expected: persistence + contract tests pass (open-meteo reachable; ORS test skips without key).

- [ ] **Step 4: Smoke the API end-to-end (optional, key needed)**

With `OPENROUTESERVICE_API_KEY` set and Postgres running:
`dotnet run --project backend/WeatherRoute.Api` then:
```bash
curl -X POST http://localhost:5080/api/routes/analyze -H "Content-Type: application/json" -d '{"origin":"Ciudad Real","destination":"Almagro","activity":"Cycling","departureTime":"2026-09-27T08:00:00Z"}'
```
Expected: `status: "full"`, routes with segments carrying weather and risk.

- [ ] **Step 5: Final status, README roadmap check, commit any leftovers**

```bash
git status
git add -A
git commit -m "chore: verification pass fixes"
```
(only if there are changes)