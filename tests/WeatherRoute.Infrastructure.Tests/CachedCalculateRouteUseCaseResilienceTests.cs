using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Infrastructure.Caching;
using Xunit;

namespace WeatherRoute.Infrastructure.Tests;

public class CachedCalculateRouteUseCaseResilienceTests
{
    [Fact]
    public async Task Cache_Read_Failure_Does_Not_Fail_The_Request()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, "r", Array.Empty<RouteCandidate>());
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new ThrowingDistributedCache(), new CachingOptions());

        var result = await useCase.ExecuteAsync(Command());

        Assert.NotNull(result);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task Cache_Write_Failure_Does_Not_Fail_The_Request()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, "r", Array.Empty<RouteCandidate>());
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new ThrowingDistributedCache(throwOnWrite: true), new CachingOptions());

        var result = await useCase.ExecuteAsync(Command());

        Assert.NotNull(result);
        Assert.Equal(1, calls);
    }

    [Fact]
    public async Task When_Cache_Read_Fails_Every_Call_Reaches_The_UseCase()
    {
        int calls = 0;
        var inner = new FakeInner(() =>
        {
            calls++;
            return new RouteAnalysisResponse(true, true, "r", Array.Empty<RouteCandidate>());
        });
        var useCase = new CachedCalculateRouteUseCase(inner, new ThrowingDistributedCache(), new CachingOptions());

        await useCase.ExecuteAsync(Command());
        await useCase.ExecuteAsync(Command());

        Assert.Equal(2, calls);
    }

    private static CalculateRouteCommand Command() =>
        new("Ciudad Real", "Almagro", ActivityType.Cycling, new DateTime(2026, 9, 27, 8, 0, 0, DateTimeKind.Utc));

    private sealed class FakeInner(Func<RouteAnalysisResponse> factory) : ICalculateRouteUseCase
    {
        public Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default) =>
            Task.FromResult(factory());
    }

    private sealed class ThrowingDistributedCache(bool throwOnWrite = false) : IDistributedCache
    {
        public byte[] Get(string key) => throw new InvalidOperationException("redis down");
        public Task<byte[]> GetAsync(string key, CancellationToken token = default) =>
            throw new InvalidOperationException("redis down");
        public void Set(string key, byte[] value, DistributedCacheEntryOptions options)
        {
            if (throwOnWrite) throw new InvalidOperationException("redis down");
        }
        public Task SetAsync(string key, byte[] value, DistributedCacheEntryOptions options, CancellationToken token = default) =>
            throwOnWrite ? throw new InvalidOperationException("redis down") : Task.CompletedTask;
        public void Refresh(string key) { }
        public Task RefreshAsync(string key, CancellationToken token = default) => Task.CompletedTask;
        public void Remove(string key) { }
        public Task RemoveAsync(string key, CancellationToken token = default) => Task.CompletedTask;
    }
}