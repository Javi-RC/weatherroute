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
    public void Short_Route_Samples_Interior_Points()
    {
        var sampler = new RouteSampler();
        var route = sampler.Sample(StraightLine(2, 11), Domain.Enums.ActivityType.Walking,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.True(route.Segments.Count > 1);
        Assert.True(route.Geometry.Count > 2);
        Assert.Equal(2, route.TotalDistance.Km, 1);
    }

    [Fact]
    public void Short_Winding_Route_Keeps_The_Bend()
    {
        var sampler = new RouteSampler();
        var bend = new Coordinates(0.001, 0.001);
        var geom = new[] { new Coordinates(0, 0), bend, new Coordinates(0.002, 0) };
        var hours = Math.Round(0.3 / ActivityPace.GetKmh(WeatherRoute.Domain.Enums.ActivityType.Walking), 4);
        var route = sampler.Sample(new ExternalRoute("test", 0.3, TimeSpan.FromHours(hours), geom),
            WeatherRoute.Domain.Enums.ActivityType.Walking,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.Contains(bend, route.Geometry);
    }

    [Fact]
    public void Long_Route_Beyond_Max_Samples_Reports_Full_Distance()
    {
        var sampler = new RouteSampler();
        var route = sampler.Sample(StraightLine(500, 5001), Domain.Enums.ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        Assert.True(route.TotalDistance.Km > 480);
        Assert.Equal(19, route.Segments.Count);
        Assert.Equal(route.Geometry[^1], route.Segments[^1].End);
        var last = route.Segments[^1];
        Assert.NotNull(last.ArrivalTime);
    }
}