using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.Extensions.Caching.Distributed;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;

namespace WeatherRoute.Infrastructure.Caching;

public sealed class CachedCalculateRouteUseCase : ICalculateRouteUseCase
{
    private readonly ICalculateRouteUseCase _inner;
    private readonly IDistributedCache _cache;
    private readonly CachingOptions _options;
    private readonly JsonSerializerOptions _json;

    public CachedCalculateRouteUseCase(
        ICalculateRouteUseCase inner,
        IDistributedCache cache,
        CachingOptions options,
        JsonSerializerOptions? json = null)
    {
        _inner = inner;
        _cache = cache;
        _options = options;
        _json = json ?? new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            Converters = { new JsonStringEnumConverter() }
        };
    }

    public async Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default)
    {
        string key = BuildKey(command);
        var cached = await _cache.GetAsync(key, ct);
        if (cached is not null)
            return JsonSerializer.Deserialize<RouteAnalysisResponse>(cached, _json)!;

        var result = await _inner.ExecuteAsync(command, ct);
        await _cache.SetAsync(key, JsonSerializer.SerializeToUtf8Bytes(result, _json), Ttl(), ct);
        return result;
    }

    public static string BuildKey(CalculateRouteCommand command)
    {
        var raw = $"{command.Origin.ToLowerInvariant()}|{command.Destination.ToLowerInvariant()}|{command.Activity}|{command.DepartureTimeUtc:o}";
        var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(raw))).ToLowerInvariant();
        return $"route-analysis:{hash}";
    }

    private DistributedCacheEntryOptions Ttl()
    {
        if (_options.OverrideTtl is { } fixedTtl)
            return new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = fixedTtl };

        return new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = CalculateTtl(DateTimeOffset.UtcNow) };
    }

    internal static TimeSpan CalculateTtl(DateTimeOffset now)
    {
        var nextHour = new DateTimeOffset(now.Year, now.Month, now.Day, now.Hour, 0, 0, TimeSpan.Zero).AddHours(1);
        var ttl = nextHour - now;
        if (ttl < TimeSpan.FromSeconds(60)) ttl = TimeSpan.FromSeconds(60);
        if (ttl > TimeSpan.FromHours(6)) ttl = TimeSpan.FromHours(6);
        return ttl;
    }
}