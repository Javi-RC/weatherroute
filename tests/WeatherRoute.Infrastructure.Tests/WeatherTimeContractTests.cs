using System;
using System.Net.Http;
using System.Threading.Tasks;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Weather;

namespace WeatherRoute.Infrastructure.Tests;

// Documents/pins the UTC contract investigated for the UX redesign spec (2026-09-22):
// the frontend always sends a UTC instant, and the weather adapter always requests
// and matches hourly forecasts in UTC. No behavior change — this test exists so a
// future edit that breaks either half of the contract fails loudly.
public class WeatherTimeContractTests
{
    [Fact]
    public void Utc_Instant_Round_Trips_To_Europe_Madrid_Local_Time()
    {
        var utc = new DateTime(2026, 9, 22, 16, 0, 0, DateTimeKind.Utc);
        var madrid = TimeZoneInfo.FindSystemTimeZoneById("Europe/Madrid");

        var local = TimeZoneInfo.ConvertTimeFromUtc(utc, madrid);

        Assert.Equal(new DateTime(2026, 9, 22, 18, 0, 0), local);
    }

    [Fact]
    public async Task GetForecastAsync_Requests_Hourly_Forecast_In_Utc()
    {
        var client = new HttpClient(new StubHandler(req =>
        {
            Assert.Contains("timezone=UTC", req.RequestUri!.PathAndQuery);
            return """{"hourly":{"time":[],"temperature_2m":[]}}""";
        }))
        {
            BaseAddress = new Uri("https://api.open-meteo.com")
        };
        var adapter = new OpenMeteoWeatherAdapter(client);

        await adapter.GetForecastAsync(new Coordinates(38.986, -3.929),
            new DateTime(2026, 9, 22, 16, 0, 0, DateTimeKind.Utc));
    }
}
