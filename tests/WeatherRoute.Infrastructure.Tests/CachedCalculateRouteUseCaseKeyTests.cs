#nullable enable
using System;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Caching;

namespace WeatherRoute.Infrastructure.Tests;

public sealed class CachedCalculateRouteUseCaseKeyTests
{
    private static readonly DateTime Departure = new(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc);

    private static CalculateRouteCommand Command(
        string? origin = null, string? destination = null,
        Coordinates? originCoordinates = null, Coordinates? destinationCoordinates = null,
        ActivityType activity = ActivityType.Cycling) =>
        new(origin, destination, originCoordinates, destinationCoordinates, activity, Departure);

    [Fact]
    public void Same_coordinates_with_different_labels_share_a_key()
    {
        var a = CachedCalculateRouteUseCase.BuildKey(Command(
            "Madrid", "Toledo", new Coordinates(40.4168, -3.7038), new Coordinates(39.8628, -4.0273)));
        var b = CachedCalculateRouteUseCase.BuildKey(Command(
            "Puerta del Sol", "Alcazar", new Coordinates(40.4168, -3.7038), new Coordinates(39.8628, -4.0273)));

        Assert.Equal(a, b);
    }

    [Fact]
    public void Coordinates_within_eleven_metres_share_a_key()
    {
        var a = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.41680, -3.70380),
            destinationCoordinates: new Coordinates(39.86280, -4.02730)));
        var b = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.41682, -3.70381),
            destinationCoordinates: new Coordinates(39.86281, -4.02731)));

        Assert.Equal(a, b);
    }

    [Fact]
    public void Distinguishable_coordinates_produce_different_keys()
    {
        var a = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273)));
        var b = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(41.0000, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273)));

        Assert.NotEqual(a, b);
    }

    [Fact]
    public void A_text_endpoint_never_collides_with_a_coordinate_endpoint()
    {
        var byText = CachedCalculateRouteUseCase.BuildKey(Command("40.4168,-3.7038", "39.8628,-4.0273"));
        var byCoordinate = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038),
            destinationCoordinates: new Coordinates(39.8628, -4.0273)));

        Assert.NotEqual(byText, byCoordinate);
    }

    [Fact]
    public void Different_activities_produce_different_keys()
    {
        var cycling = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273)));
        var driving = CachedCalculateRouteUseCase.BuildKey(Command(
            originCoordinates: new Coordinates(40.4168, -3.7038), destinationCoordinates: new Coordinates(39.8628, -4.0273),
            activity: ActivityType.Driving));

        Assert.NotEqual(cycling, driving);
    }

    [Fact]
    public void Text_labels_stay_case_insensitive()
    {
        var lower = CachedCalculateRouteUseCase.BuildKey(Command("madrid", "toledo"));
        var upper = CachedCalculateRouteUseCase.BuildKey(Command("Madrid", "TOLEDO"));

        Assert.Equal(lower, upper);
    }
}
