using System;
using System.Globalization;
using System.Net.Http;
using System.Threading.Tasks;
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