namespace WeatherRoute.Infrastructure.Caching;

public sealed class CachingOptions
{
    public string Provider { get; set; } = "InMemory";
    public TimeSpan? OverrideTtl { get; set; }
}