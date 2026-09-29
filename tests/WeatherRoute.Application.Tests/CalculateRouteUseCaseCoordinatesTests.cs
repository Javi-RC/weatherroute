#nullable enable
using System;
using System.Threading.Tasks;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Services;
using WeatherRoute.Application.UseCases;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Tests;

public sealed class CalculateRouteUseCaseCoordinatesTests
{
    private static readonly DateTime Departure = new(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc);
    private static readonly Coordinates Madrid = new(40.4168, -3.7038);
    private static readonly Coordinates Toledo = new(39.8628, -4.0273);

    private static CalculateRouteUseCase Build(FakeGeocoder geocoding, FakeRouteProvider routes) =>
        new(geocoding, routes, new FakeWeather(), new RouteSampler(),
            new RouteRiskAssessmentService(new RouteRiskEngine()));

    [Fact]
    public async Task Uses_supplied_coordinates_without_geocoding()
    {
        var geocoding = new FakeGeocoder();
        var routes = new FakeRouteProvider();

        var result = await Build(geocoding, routes).ExecuteAsync(new CalculateRouteCommand(
            Origin: null, Destination: null,
            OriginCoordinates: Madrid, DestinationCoordinates: Toledo,
            Activity: ActivityType.Cycling, DepartureTimeUtc: Departure));

        Assert.Empty(geocoding.Queries);
        Assert.True(result.RouteAvailable);
        Assert.Equal(2, result.Routes.Count);
    }

    [Fact]
    public async Task Routes_between_the_supplied_coordinates()
    {
        var geocoding = new FakeGeocoder();
        var routes = new FakeRouteProvider();

        await Build(geocoding, routes).ExecuteAsync(new CalculateRouteCommand(
            Origin: null, Destination: null,
            OriginCoordinates: Madrid, DestinationCoordinates: Toledo,
            Activity: ActivityType.Cycling, DepartureTimeUtc: Departure));

        var call = Assert.Single(routes.Calls);
        Assert.Equal(Madrid, call.Origin);
        Assert.Equal(Toledo, call.Destination);
    }

    [Fact]
    public async Task Geocodes_only_the_endpoint_without_coordinates()
    {
        var geocoding = new FakeGeocoder();
        var routes = new FakeRouteProvider();

        await Build(geocoding, routes).ExecuteAsync(new CalculateRouteCommand(
            Origin: "Ciudad Real", Destination: null,
            OriginCoordinates: null, DestinationCoordinates: Toledo,
            Activity: ActivityType.Cycling, DepartureTimeUtc: Departure));

        Assert.Equal(new[] { "Ciudad Real" }, geocoding.Queries);
        Assert.Equal(Toledo, routes.Calls[0].Destination);
    }

    [Fact]
    public async Task Geocodes_both_endpoints_when_no_coordinates_are_supplied()
    {
        var geocoding = new FakeGeocoder();
        var routes = new FakeRouteProvider();

        await Build(geocoding, routes).ExecuteAsync(new CalculateRouteCommand(
            Origin: "Ciudad Real", Destination: "Almagro",
            OriginCoordinates: null, DestinationCoordinates: null,
            Activity: ActivityType.Cycling, DepartureTimeUtc: Departure));

        Assert.Equal(new[] { "Ciudad Real", "Almagro" }, geocoding.Queries);
    }

    [Fact]
    public async Task Returns_no_routes_when_an_endpoint_has_neither_text_nor_coordinates()
    {
        var geocoding = new FakeGeocoder();
        var routes = new FakeRouteProvider();

        var result = await Build(geocoding, routes).ExecuteAsync(new CalculateRouteCommand(
            Origin: null, Destination: "Almagro",
            OriginCoordinates: null, DestinationCoordinates: null,
            Activity: ActivityType.Cycling, DepartureTimeUtc: Departure));

        Assert.False(result.RouteAvailable);
        Assert.Empty(result.Routes);
        Assert.Empty(routes.Calls);
    }
}
