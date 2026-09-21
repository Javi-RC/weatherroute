using System;
using System.Linq;
using WeatherRoute.Application.Services;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Tests;

public class RouteSamplerTests
{
    private static ExternalRoute StraightLine(double distanceKm, int points)
    {
        var geom = Enumerable.Range(0, points)
            .Select(i => new Coordinates(0, i * (distanceKm / (points - 1)) / 111.0))
            .ToList();
        var hours = Math.Round(distanceKm / ActivityPace.GetKmh(WeatherRoute.Domain.Enums.ActivityType.Cycling), 4);
        return new ExternalRoute("test", distanceKm, TimeSpan.FromHours(hours), geom);
    }

    [Fact]
    public void Samples_Every_10Km_And_Sets_Arrival()
    {
        var sampler = new RouteSampler();
        var route = sampler.Sample(StraightLine(40, 401), Domain.Enums.ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.True(route.Segments.Count >= 3);      // 0..10..20..30..40
        Assert.Equal(40, route.TotalDistance.Km, 0);
        Assert.True((route.TotalDuration - TimeSpan.FromHours(2)).Duration() <= TimeSpan.FromMinutes(5));
        var last = route.Segments[^1];
        Assert.NotNull(last.ArrivalTime);
    }

    [Fact]
    public void Short_Route_Produces_Single_Segment()
    {
        var sampler = new RouteSampler();
        var route = sampler.Sample(StraightLine(2, 11), Domain.Enums.ActivityType.Walking,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.Single(route.Segments);
        Assert.Equal(2, route.TotalDistance.Km, 1);
    }
}