using System;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Caching.Memory;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Caching;
using Xunit;

namespace WeatherRoute.Infrastructure.Tests;

public class CachedCalculateRouteUseCaseTests
{
    private static readonly JsonSerializerOptions Json = new() { PropertyNamingPolicy = JsonNamingPolicy.CamelCase, Converters = { new JsonStringEnumConverter() } };
    private static readonly CachingOptions Options = new();

    [Fact]
    public async Task Second_Call_Skips_Inner()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, "r",
                new[] { new RouteCandidate("p", 74, 168, RiskLevel.Low, 88, Array.Empty<RiskFactor>(), Array.Empty<SegmentResult>(), Array.Empty<Coordinates>()) });
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new MemoryDistributedCache(Microsoft.Extensions.Options.Options.Create(new MemoryDistributedCacheOptions())), Options, Json);
        var command = new CalculateRouteCommand("A", "B", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

        await useCase.ExecuteAsync(command);
        await useCase.ExecuteAsync(command);

        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task Different_Commands_Are_Not_Cached_Together()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, null, Array.Empty<RouteCandidate>());
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new MemoryDistributedCache(Microsoft.Extensions.Options.Options.Create(new MemoryDistributedCacheOptions())), Options, Json);

        await useCase.ExecuteAsync(new CalculateRouteCommand("A", "B", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc)));
        await useCase.ExecuteAsync(new CalculateRouteCommand("B", "A", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc)));

        Assert.Equal(2, calls);
    }

    [Fact]
    public async Task Different_MaxDuration_Are_Not_Cached_Together()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, null, Array.Empty<RouteCandidate>());
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new MemoryDistributedCache(Microsoft.Extensions.Options.Options.Create(new MemoryDistributedCacheOptions())), Options, Json);
        var baseCommand = CalculateRouteCommand_();
        var filtered = baseCommand with { MaxDurationMinutes = 120 };

        await useCase.ExecuteAsync(baseCommand);
        await useCase.ExecuteAsync(filtered);

        Assert.Equal(2, calls);
    }

    [Fact]
    public void BuildKey_Differentiates_By_MaxDuration()
    {
        var baseCommand = CalculateRouteCommand_();
        var filtered = baseCommand with { MaxDurationMinutes = 120 };

        Assert.NotEqual(
            CachedCalculateRouteUseCase.BuildKey(baseCommand),
            CachedCalculateRouteUseCase.BuildKey(filtered));
    }

    private static CalculateRouteCommand CalculateRouteCommand_() =>
        new("Ciudad Real", "Almagro", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

    [Theory]
    [InlineData(10, 30, 0)]        
    [InlineData(21, 0, 0)]
    [InlineData(23, 45, 0)]
    public void CalculateTtl_Next_Hour_Is_Reached(int hour, int minute, int second)
    {
        var now = new DateTimeOffset(2026, 9, 27, hour, minute, second, TimeSpan.Zero);
        var nextHour = new DateTimeOffset(2026, 9, 27, hour, 0, 0, TimeSpan.Zero).AddHours(1);

        var ttl = CachedCalculateRouteUseCase.CalculateTtl(now);

        Assert.Equal(nextHour - now, ttl);
    }

    [Fact]
    public void CalculateTtl_Rolls_To_Next_Day_At_23h()
    {
        var now = new DateTimeOffset(2026, 9, 27, 23, 0, 0, TimeSpan.Zero);

        var ttl = CachedCalculateRouteUseCase.CalculateTtl(now);

        Assert.Equal(TimeSpan.FromHours(1), ttl);
    }

    [Fact]
    public void CalculateTtl_Floors_At_One_Minute()
    {
        var now = new DateTimeOffset(2026, 9, 27, 23, 59, 59, TimeSpan.Zero);

        var ttl = CachedCalculateRouteUseCase.CalculateTtl(now);

        Assert.Equal(TimeSpan.FromSeconds(60), ttl);
    }

    private sealed class FakeInner(Func<RouteAnalysisResponse> factory) : ICalculateRouteUseCase
    {
        public Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default) =>
            Task.FromResult(factory());
    }
}