using System;
using System.Threading.Tasks;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Services;
using WeatherRoute.Application.UseCases;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Tests;

public class CalculateRouteUseCaseTests
{
    private static ICalculateRouteUseCase Build(FakeWeather weather) => new CalculateRouteUseCase(
        new FakeGeocoder(),
        new FakeRouteProvider(),
        weather, new RouteSampler(), new RouteRiskAssessmentService(new RouteRiskEngine()));

    [Fact]
    public async Task Returns_Two_Weather_Enriched_Routes()
    {
        var weather = new FakeWeather();
        var useCase = Build(weather);

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), null));

        Assert.Equal("full", result.Status);
        Assert.True(result.WeatherAvailable);
        Assert.Equal(2, result.Routes.Count);
        Assert.All(result.Routes, r => Assert.Contains(r.Segments, s => s.Weather is not null));
        Assert.NotNull(result.Recommendation);
    }

    [Fact]
    public async Task Filters_By_MaxDuration()
    {
        var weather = new FakeWeather();
        var useCase = Build(weather);

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), 120));

        Assert.Single(result.Routes);                            // fake-a ~66 min (direct geometry) passes, fake-b ~146 min (detour geometry) filtered
        Assert.True(result.Routes[0].DurationMinutes <= 120);
    }

    [Fact]
    public async Task Partial_When_Weather_Fails()
    {
        var failingWeather = new FakeWeather { Fail = true };
        var useCase = Build(failingWeather);

        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), null));

        Assert.Equal("partial", result.Status);
        Assert.False(result.WeatherAvailable);
        Assert.True(result.RouteAvailable);
    }

    [Fact]
    public async Task Risk_Is_Computed_From_Weather()
    {
        var useCase = Build(new FakeWeather());
        var result = await useCase.ExecuteAsync(new CalculateRouteCommand(
            "Ciudad Real", "Almagro", ActivityType.Cycling,
            new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc), null));

        Assert.All(result.Routes, r =>
        {
            Assert.InRange(r.RiskScore, 0, 100);
            Assert.NotEmpty(r.Factors); // FakeWeather wind 30 → Cycling WIND factor (+25) → score 75
        });
    }
}
