using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Dtos;

public sealed record ExternalWeather(
    double? TemperatureC,
    double? WindKmh,
    double? PrecipitationProbability,
    int? UvIndex,
    double? VisibilityKm,
    WeatherCondition Condition);
