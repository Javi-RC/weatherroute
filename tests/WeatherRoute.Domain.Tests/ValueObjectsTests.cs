using System;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class ValueObjectsTests
{
    [Fact]
    public void Coordinates_Haversine_Zero_Distance()
    {
        var a = new Coordinates(38.98, -3.92);
        Assert.Equal(0, a.DistanceKmTo(a), 5);
    }

    [Fact]
    public void Coordinates_Distance_Montmelo()
    {
        var ciu = new Coordinates(38.986, -3.929);
        var alm = new Coordinates(38.888, -3.712);
        var km = ciu.DistanceKmTo(alm);
        Assert.InRange(km, 15, 25);
    }

    [Fact]
    public void Coordinates_Invalid_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Coordinates(91, 0));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Coordinates(0, -181));
    }

    [Fact]
    public void Distance_Invalid_Throws()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => new Distance(-1));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Duration(TimeSpan.FromMinutes(-1)));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Wind(-2));
        Assert.Throws<ArgumentOutOfRangeException>(() => new Temperature(100));
    }

    [Fact]
    public void Records_Compare_By_Value()
    {
        Assert.Equal(new Coordinates(1, 2), new Coordinates(1, 2));
        Assert.Equal(new Distance(5), new Distance(5));
        Assert.True(new Wind(20).Kmh > new Wind(12).Kmh);
    }
}
