using Microsoft.Extensions.Diagnostics.HealthChecks;
using StackExchange.Redis;

namespace WeatherRoute.Api.Health;

public sealed class RedisHealthCheck(IConnectionMultiplexer connection) : IHealthCheck
{
    public async Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        try
        {
            await connection.GetDatabase().PingAsync().WaitAsync(TimeSpan.FromSeconds(3), cancellationToken);
            return HealthCheckResult.Healthy();
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("Redis is unreachable.", ex);
        }
    }
}