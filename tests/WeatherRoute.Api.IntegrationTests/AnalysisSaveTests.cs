using System;
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

public class AnalysisSaveTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public AnalysisSaveTests(WebApplicationFactory<Program> factory) => _factory = factory;

    [Fact]
    public async Task Saves_Analysis_With_Geocoded_Coordinates()
    {
        var captured = new CapturingRepository();
        using var app = _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Persistence:AutoMigrate", "false");
            b.UseSetting("CachingOptions:Provider", "InMemory");
            b.ConfigureTestServices(services =>
            {
                services.RemoveAll<IGeocodingProvider>();
                services.RemoveAll<IAnalysisRepository>();
                services.AddSingleton<IGeocodingProvider>(new StubGeocoder());
                services.AddSingleton<IAnalysisRepository>(captured);
            });
        });
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
        var body = await response.Content.ReadFromJsonAsync<JsonDocument>();
        var saved = captured.Saved;
        Assert.NotNull(saved);
        Assert.Equal(body.RootElement.GetProperty("id").GetGuid(), saved.Id);
        Assert.NotEqual(new Coordinates(0, 0), saved.OriginCoordinates);
        Assert.Equal(38.986, saved.OriginCoordinates.Latitude, 3);
        Assert.Equal(-3.929, saved.OriginCoordinates.Longitude, 3);
        Assert.Equal(38.888, saved.DestinationCoordinates.Latitude, 3);
        Assert.Equal(-3.712, saved.DestinationCoordinates.Longitude, 3);
    }

    private sealed class StubGeocoder : IGeocodingProvider
    {
        public Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default) =>
            Task.FromResult(query.ToLowerInvariant().Contains("almagro")
                ? new Coordinates(38.888, -3.712)
                : new Coordinates(38.986, -3.929));
    }

    private sealed class CapturingRepository : IAnalysisRepository
    {
        public RouteAnalysisRecord Saved { get; private set; }

        public Task<Guid> SaveAsync(RouteAnalysisRecord record, CancellationToken ct = default)
        {
            Saved = record;
            return Task.FromResult(record.Id);
        }
    }
}