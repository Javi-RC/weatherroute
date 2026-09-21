using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Entities;

public sealed record WeatherSnapshot(
    Temperature? Temperature,
    Wind? Wind,
    double? PrecipitationProbability,
    int? UvIndex,
    double? VisibilityKm,
    WeatherCondition Condition);
