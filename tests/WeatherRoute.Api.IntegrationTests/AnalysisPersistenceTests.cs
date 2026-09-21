using System;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Testcontainers.PostgreSql;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Api.IntegrationTests;

public sealed class AnalysisPersistenceTests : IAsyncLifetime
{
    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:16-alpine")
        .WithDatabase("weatherroute")
        .WithUsername("weatherroute")
        .WithPassword("weatherroute")
        .Build();

    [Fact]
    [Trait("Category", "Integration")]
    public async Task Saves_Anonymous_Analysis()
    {
        using var app = new WebApplicationFactory<Program>()
            .WithWebHostBuilder(b =>
            {
                b.UseSetting("ConnectionStrings:DefaultConnection", _postgres.GetConnectionString());
                b.ConfigureTestServices(services =>
                {
                    services.RemoveAll<IGeocodingProvider>();
                    services.AddSingleton<IGeocodingProvider>(new StubGeocoder());
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

internal sealed class StubGeocoder : IGeocodingProvider
{
    public Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default) =>
        Task.FromResult(new Coordinates(38.9, -3.8));
}