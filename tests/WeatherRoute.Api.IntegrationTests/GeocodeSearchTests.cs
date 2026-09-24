using System.Collections.Generic;
using System.Net;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Routing;
using Xunit;

namespace WeatherRoute.Api.IntegrationTests;

public class GeocodeSearchTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public GeocodeSearchTests(WebApplicationFactory<Program> factory) => _factory = factory;

    private WebApplicationFactory<Program> Build(
        IReadOnlyList<GeocodingCandidate> candidates = null,
        string reverseLabel = null,
        bool geocodeThrows = false) =>
        _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Persistence:AutoMigrate", "false");
            b.UseSetting("CachingOptions:Provider", "InMemory");
            b.ConfigureTestServices(services =>
            {
                services.RemoveAll<IGeocodingProvider>();
                services.RemoveAll<IGeocodingDiscoveryProvider>();
                services.AddSingleton<IGeocodingProvider>(new StubGeocoder(geocodeThrows));
                services.AddSingleton<IGeocodingDiscoveryProvider>(
                    new StubDiscovery(candidates ?? [], reverseLabel));
            });
        });

    [Fact]
    public async Task Search_Returns_Query_And_Candidates()
    {
        using var factory = Build(candidates:
        [
            new GeocodingCandidate("Ciudad Real, España", 38.986, -3.929),
        ]);
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/geocode/search?q=Ciudad");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.Equal("Ciudad", doc.RootElement.GetProperty("query").GetString());
        var candidates = doc.RootElement.GetProperty("candidates");
        Assert.Equal(1, candidates.GetArrayLength());
        Assert.Equal("Ciudad Real, España", candidates[0].GetProperty("label").GetString());
    }

    [Fact]
    public async Task Search_Blank_Query_Returns_BadRequest()
    {
        using var factory = Build();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/geocode/search?q=");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Reverse_Returns_Label()
    {
        using var factory = Build(reverseLabel: "Ciudad Real, España");
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/geocode/reverse?lat=38.986&lon=-3.929");

        Assert.Equal(HttpStatusCode.OK, resp.StatusCode);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.Equal("Ciudad Real, España", doc.RootElement.GetProperty("label").GetString());
    }

    [Fact]
    public async Task Reverse_Missing_Coordinates_Returns_BadRequest()
    {
        using var factory = Build();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/geocode/reverse?lat=38.986");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Reverse_Out_Of_Range_Coordinates_Returns_BadRequest()
    {
        using var factory = Build();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/geocode/reverse?lat=200&lon=0");

        Assert.Equal(HttpStatusCode.BadRequest, resp.StatusCode);
    }

    [Fact]
    public async Task Geocode_No_Result_Returns_NotFound()
    {
        using var factory = Build(geocodeThrows: true);
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/api/geocode?q=Nada+por+aqui");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
    }

    private sealed class StubGeocoder(bool throwsNotFound) : IGeocodingProvider
    {
        public Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default) =>
            throwsNotFound
                ? throw new GeocodingException($"No geocoding result for '{query}'.")
                : Task.FromResult(new Coordinates(38.0, -4.0));
    }

    private sealed class StubDiscovery(IReadOnlyList<GeocodingCandidate> candidates, string reverseLabel)
        : IGeocodingDiscoveryProvider
    {
        public Task<IReadOnlyList<GeocodingCandidate>> SearchAsync(string query, CancellationToken ct = default) =>
            Task.FromResult(candidates);

        public Task<string> GetPlaceNameAsync(double latitude, double longitude, CancellationToken ct = default) =>
            Task.FromResult(reverseLabel);
    }
}
