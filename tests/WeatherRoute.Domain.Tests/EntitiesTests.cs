using System;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class EntitiesTests
{
    [Fact]
    public void Segment_Can_AssignWeather()
    {
        var seg = new RouteSegment(new Coordinates(38.98, -3.92), new Coordinates(39.0, -3.90),
            new Distance(12), TimeSpan.FromMinutes(36), 0, 3);

        Assert.False(seg.HasWeather);
        var snap = new WeatherSnapshot(new Temperature(18), new Wind(8), 10, 3, 10, WeatherCondition.Clear);
        seg.AssignWeather(snap);
        seg.SetArrival(TimeSpan.FromMinutes(36));

        Assert.True(seg.HasWeather);
        Assert.Equal(18, seg.Weather!.Temperature!.Celsius);
        Assert.Equal(WeatherCondition.Clear, seg.Weather.Condition);
        Assert.Equal(TimeSpan.FromMinutes(36), seg.ArrivalTime);
    }

    [Fact]
    public void Route_Totals()
    {
        var seg1 = new RouteSegment(new Coordinates(0, 0), new Coordinates(0, 1), new Distance(10), TimeSpan.FromMinutes(30), 0, 1);
        var seg2 = new RouteSegment(new Coordinates(0, 1), new Coordinates(0, 2), new Distance(20), TimeSpan.FromMinutes(60), 1, 2);
        var route = new Route(ActivityType.Cycling,
            new[] { seg1, seg2 },
            new[] { new Coordinates(0, 0), new Coordinates(0, 1), new Coordinates(0, 2) });

        Assert.Equal(30, route.TotalDistance.Km);
        Assert.Equal(TimeSpan.FromMinutes(90), route.TotalDuration);
        Assert.Equal(3, route.Geometry.Count);
    }
}
