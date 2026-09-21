using System;
using System.Net.Http;
using System.Threading.Tasks;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Routing;
using WeatherRoute.Infrastructure.Weather;

namespace WeatherRoute.Infrastructure.Tests;

public class AdaptersContractTests : IAsyncLifetime
{
    private readonly HttpClient _http = new() { BaseAddress = new Uri("https://api.open-meteo.com") };

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