#nullable enable
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Tests;

public sealed class FakeGeocoder : IGeocodingProvider
{
    public List<string> Queries { get; } = new();

    public Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default)
    {
        Queries.Add(query);
        return Task.FromResult<Coordinates>(query.ToLowerInvariant().Contains("alma")
            ? new Coordinates(38.888, -3.712)
            : new Coordinates(38.986, -3.929));
    }
}

public sealed class FakeRouteProvider : IRouteProvider
{
    public List<(Coordinates Origin, Coordinates Destination)> Calls { get; } = new();

    public Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(
        Coordinates o, Coordinates d, ActivityType a, CancellationToken ct = default)
    {
        Calls.Add((o, d));
        var geom = new[] { o, new Coordinates((o.Latitude + d.Latitude) / 2, (o.Longitude + d.Longitude) / 2), d };
        var detour = new Coordinates((o.Latitude + d.Latitude) / 2 - 0.2, (o.Longitude + d.Longitude) / 2);
        var longerGeom = new[] { o, detour, d };
        var list = new List<ExternalRoute>
        {
            new("fake-a", 40, TimeSpan.FromHours(2), geom),
            new("fake-b", 50, TimeSpan.FromHours(2.5), longerGeom)
        };
        return Task.FromResult<IReadOnlyList<ExternalRoute>>(list);
    }
}

public sealed class FakeWeather : IWeatherProvider
{
    public bool Fail { get; set; }
    public Task<ExternalWeather?> GetForecastAsync(Coordinates coordinates, DateTime timestampUtc, CancellationToken ct = default) =>
        Fail ? throw new HttpRequestException("upstream down")
             : Task.FromResult<ExternalWeather?>(new ExternalWeather(27, 30, 5, 3, 4, WeatherCondition.Clear));
}
