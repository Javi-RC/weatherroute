using System;
using System.Net;
using System.Net.Http.Json;
using System.Threading.Tasks;
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