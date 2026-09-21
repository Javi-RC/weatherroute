using System.Globalization;
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
            GetHourly<double>(hourly, "temperature_2m", index),
            GetHourly<double>(hourly, "wind_speed_10m", index),
            GetHourly<double>(hourly, "precipitation_probability", index),
            (int?)Math.Round(GetHourly<double>(hourly, "uv_index", index) ?? 0),
            (GetHourly<double>(hourly, "visibility", index) is { } v) ? v / 1000.0 : null,
            WeatherCodeMapper.Map((int)(GetHourly<double>(hourly, "weather_code", index) ?? 0)));
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