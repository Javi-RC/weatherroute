using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using Xunit;

namespace WeatherRoute.Api.IntegrationTests;

public class RouteAnalyzeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public RouteAnalyzeTests(WebApplicationFactory<Program> factory) => _factory = factory;

    private WebApplicationFactory<Program> Build(IReadOnlyList<ExternalRoute> routes, bool weatherFails = false) =>
        _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Persistence:AutoMigrate", "false");
            b.UseSetting("CachingOptions:Provider", "InMemory");
            b.ConfigureTestServices(services =>
            {
                services.RemoveAll<IGeocodingProvider>();
                services.RemoveAll<IRouteProvider>();
                services.RemoveAll<IWeatherProvider>();
                services.AddSingleton<IGeocodingProvider>(new StubGeocoder());
                services.AddSingleton<IRouteProvider>(new StubRouteProvider(routes.ToArray()));
                services.AddSingleton<IWeatherProvider>(new StubWeather(weatherFails));
            });
        });

    [Fact]
    public async Task Valid_Request_Returns_Full_Analysis()
    {
        using var factory = Build(new[] { Route("a", 20), Route("b", 40) });
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/routes/analyze", ValidBody());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        Assert.Equal("full", root.GetProperty("status").GetString());
        Assert.True(root.GetProperty("weatherAvailable").GetBoolean());
        Assert.True(root.GetProperty("routeAvailable").GetBoolean());
        Assert.Equal(2, root.GetProperty("routes").GetArrayLength());
        Assert.Equal("a", root.GetProperty("routes")[0].GetProperty("providerId").GetString());
    }

    [Fact]
    public async Task Empty_Origin_Returns_ValidationProblem()
    {
        using var factory = Build(new[] { Route("a", 20) });
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/routes/analyze",
            new { origin = "", destination = "Almagro", activity = "Cycling", departureTime = "2026-09-27T08:00:00Z" });

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.True(doc.RootElement.GetProperty("errors").TryGetProperty("Origin", out _));
    }

    [Fact]
    public async Task Weather_Provider_Failure_Returns_Partial_With_Routes()
    {
        using var factory = Build(new[] { Route("a", 20) }, weatherFails: true);
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/routes/analyze", ValidBody());

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var root = doc.RootElement;
        Assert.Equal("partial", root.GetProperty("status").GetString());
        Assert.False(root.GetProperty("weatherAvailable").GetBoolean());
        Assert.True(root.GetProperty("routeAvailable").GetBoolean());
        Assert.Equal(1, root.GetProperty("routes").GetArrayLength());
    }

    [Fact]
    public async Task MaxDurationMinutes_Filters_Routes()
    {
        using var factory = Build(new[] { Route("a", 20), Route("b", 40) });
        var client = factory.CreateClient();

        var resp = await client.PostAsJsonAsync("/api/routes/analyze",
            new { origin = "Ciudad Real", destination = "Almagro", activity = "Cycling",
                departureTime = "2026-09-27T08:00:00Z", maxDurationMinutes = 90 });

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        var routes = doc.RootElement.GetProperty("routes");
        Assert.Equal(1, routes.GetArrayLength());
        Assert.InRange(routes[0].GetProperty("durationMinutes").GetInt32(), 59, 62);
    }

    private static object ValidBody() => new
    {
        origin = "Ciudad Real",
        destination = "Almagro",
        activity = "Cycling",
        departureTime = "2026-09-27T08:00:00Z"
    };

    private static ExternalRoute Route(string id, double km)
    {
        int steps = (int)System.Math.Ceiling(km / 10.0);
        var geometry = Enumerable.Range(0, steps + 1)
            .Select(i => new Coordinates(0, i * (km / steps) / 111.0))
            .ToArray();
        return new ExternalRoute(id, km, TimeSpan.FromHours(km / 20.0), geometry);
    }

    private sealed class StubGeocoder : IGeocodingProvider
    {
        public Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default) =>
            Task.FromResult(new Coordinates(38.0, -4.0));
    }

    private sealed class StubRouteProvider : IRouteProvider
    {
        private readonly ExternalRoute[] _routes;

        public StubRouteProvider(params ExternalRoute[] routes) => _routes = routes;

        public Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(
            Coordinates o, Coordinates d, ActivityType a, int alternativeCount, CancellationToken ct = default) =>
            Task.FromResult<IReadOnlyList<ExternalRoute>>(_routes);
    }

    private sealed class StubWeather : IWeatherProvider
    {
        private readonly bool _fail;

        public StubWeather(bool fail) => _fail = fail;

        public async Task<ExternalWeather> GetForecastAsync(
            Coordinates coordinates, DateTime timestampUtc, CancellationToken ct = default)
        {
            if (_fail) throw new HttpRequestException("upstream down");
            return new ExternalWeather(22, 12, 10, 4, 20, WeatherCondition.Clear);
        }
    }
}