#nullable enable
using System;
using WeatherRoute.Api.Requests;
using WeatherRoute.Domain.Enums;
using Xunit;

namespace WeatherRoute.Api.IntegrationTests;

public sealed class CalculateRouteRequestValidatorTests
{
    private static CalculateRouteRequest Request(
        string? origin = "Madrid",
        string? destination = "Toledo",
        CoordinatesDto? originCoordinates = null,
        CoordinatesDto? destinationCoordinates = null) =>
        new(origin, destination, ActivityType.Cycling, new DateTime(2026, 9, 28, 8, 0, 0, DateTimeKind.Utc),
            originCoordinates, destinationCoordinates);

    [Fact]
    public void Accepts_text_for_both_endpoints()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request());

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Accepts_coordinates_without_text()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            origin: null, destination: null,
            originCoordinates: new CoordinatesDto(40.4168, -3.7038),
            destinationCoordinates: new CoordinatesDto(39.8628, -4.0273)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Accepts_a_mix_of_text_and_coordinates()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            destination: null,
            destinationCoordinates: new CoordinatesDto(39.8628, -4.0273)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Rejects_an_origin_with_neither_text_nor_coordinates()
    {
        var result = new CalculateRouteRequestValidator()
            .Validate(Request(origin: null, originCoordinates: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Origin");
    }

    [Fact]
    public void Rejects_a_destination_with_neither_text_nor_coordinates()
    {
        var result = new CalculateRouteRequestValidator()
            .Validate(Request(destination: null, destinationCoordinates: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Destination");
    }

    [Fact]
    public void Rejects_a_whitespace_only_origin_without_coordinates()
    {
        var result = new CalculateRouteRequestValidator()
            .Validate(Request(origin: "   ", originCoordinates: null));

        Assert.False(result.IsValid);
        Assert.Contains(result.Errors, e => e.PropertyName == "Origin");
    }

    [Theory]
    [InlineData(91.0, 0.0)]
    [InlineData(-91.0, 0.0)]
    [InlineData(0.0, 181.0)]
    [InlineData(0.0, -181.0)]
    public void Rejects_out_of_range_coordinates(double latitude, double longitude)
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            destination: null,
            destinationCoordinates: new CoordinatesDto(latitude, longitude)));

        Assert.False(result.IsValid);
    }

    [Fact]
    public void Accepts_coordinates_on_the_range_boundary()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            destination: null,
            destinationCoordinates: new CoordinatesDto(90, 180)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Accepts_a_label_longer_than_200_characters_when_coordinates_are_supplied()
    {
        var result = new CalculateRouteRequestValidator().Validate(Request(
            originCoordinates: new CoordinatesDto(40.4168, -3.7038),
            origin: new string('x', 201)));

        Assert.True(result.IsValid);
    }

    [Fact]
    public void Rejects_a_label_longer_than_200_characters_without_coordinates()
    {
        var result = new CalculateRouteRequestValidator()
            .Validate(Request(origin: new string('x', 201)));

        Assert.False(result.IsValid);
    }
}
