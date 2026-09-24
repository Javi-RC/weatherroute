using System.Text;
using System.Text.Json;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Infrastructure.Routing;

public sealed class OpenRouteServiceRoutingAdapter : IGeocodingProvider, IRouteProvider, IGeocodingDiscoveryProvider
{
    private const int MaxSearchCandidates = 6;

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
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/v2/geocode/search?text={encoded}");
        req.Headers.Add("Authorization", _options.ApiKey);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var features = doc.RootElement.GetProperty("features");
        if (features.GetArrayLength() == 0)
            throw new GeocodingException($"No geocoding result for '{query}'.");
        var coords = features[0].GetProperty("geometry").GetProperty("coordinates");
        return new Coordinates(coords[1].GetDouble(), coords[0].GetDouble());
    }

    public async Task<IReadOnlyList<GeocodingCandidate>> SearchAsync(string query, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(query))
            return Array.Empty<GeocodingCandidate>();
        var encoded = Uri.EscapeDataString(query.Trim());
        using var req = new HttpRequestMessage(HttpMethod.Get, $"/v2/geocode/search?text={encoded}");
        req.Headers.Add("Authorization", _options.ApiKey);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var features = doc.RootElement.GetProperty("features");

        var result = new List<GeocodingCandidate>();
        foreach (var feature in features.EnumerateArray())
        {
            if (result.Count >= MaxSearchCandidates) break;
            var label = feature.GetProperty("properties").GetProperty("label").GetString() ?? string.Empty;
            var coords = feature.GetProperty("geometry").GetProperty("coordinates");
            IReadOnlyList<double>? bbox = feature.TryGetProperty("bbox", out var bboxEl)
                ? bboxEl.EnumerateArray().Select(e => e.GetDouble()).ToArray()
                : null;
            result.Add(new GeocodingCandidate(label, coords[1].GetDouble(), coords[0].GetDouble(), bbox));
        }

        return result;
    }

    public async Task<string?> GetPlaceNameAsync(double latitude, double longitude, CancellationToken ct = default)
    {
        using var req = new HttpRequestMessage(HttpMethod.Get,
            $"/v2/geocode/reverse?point.lon={longitude.ToString(System.Globalization.CultureInfo.InvariantCulture)}&point.lat={latitude.ToString(System.Globalization.CultureInfo.InvariantCulture)}&size=1");
        req.Headers.Add("Authorization", _options.ApiKey);
        using var resp = await _http.SendAsync(req, ct);
        resp.EnsureSuccessStatusCode();
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync(ct));
        var features = doc.RootElement.GetProperty("features");
        if (features.GetArrayLength() == 0) return null;
        return features[0].GetProperty("properties").GetProperty("label").GetString();
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