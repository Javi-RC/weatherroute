using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Http.Resilience;
using Microsoft.Extensions.Options;
using Polly;
using WeatherRoute.Infrastructure.Routing;

namespace WeatherRoute.Infrastructure.Resilience;

public static class ResilienceExtensions
{
    public static IServiceCollection AddWeatherRouteResilience(this IServiceCollection services)
    {
        services.AddHttpClient("ors", (sp, client) =>
        {
            var options = sp.GetRequiredService<IOptions<OpenRouteServiceOptions>>().Value;
            client.BaseAddress = new Uri(options.BaseUrl);
        }).AddResilienceHandler("ors-policy", b =>
        {
            b.AddRetry(new HttpRetryStrategyOptions { MaxRetryAttempts = 3, BackoffType = DelayBackoffType.Exponential });
            b.AddTimeout(TimeSpan.FromSeconds(15));
            b.AddCircuitBreaker(new HttpCircuitBreakerStrategyOptions
            {
                SamplingDuration = TimeSpan.FromSeconds(30),
                FailureRatio = 0.5,
                MinimumThroughput = 5,
                BreakDuration = TimeSpan.FromSeconds(20)
            });
        });

        services.AddHttpClient("open-meteo", client => client.BaseAddress = new Uri("https://api.open-meteo.com"))
            .AddResilienceHandler("weather-policy", b =>
            {
                b.AddRetry(new HttpRetryStrategyOptions { MaxRetryAttempts = 2 });
                b.AddTimeout(TimeSpan.FromSeconds(15));
            });

        return services;
    }
}