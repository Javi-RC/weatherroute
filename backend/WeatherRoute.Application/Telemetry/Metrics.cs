using System.Diagnostics.Metrics;

namespace WeatherRoute.Application.Telemetry;

public static class Metrics
{
    public const string MeterName = "WeatherRoute.Api";

    public static readonly Meter Meter = new(MeterName, "1.0.0");
    public static readonly Histogram<double> CoreApiDuration = Meter.CreateHistogram<double>("route_calculation_duration", "ms");
    public static readonly Histogram<double> WeatherApiDuration = Meter.CreateHistogram<double>("weather_api_duration", "ms");
    public static readonly Counter<long> RouteProviderErrors = Meter.CreateCounter<long>("route_provider_errors");
    public static readonly Counter<long> WeatherProviderErrors = Meter.CreateCounter<long>("weather_provider_errors");
}