using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Dtos;

public sealed record ExternalRoute(
    string ProviderId,
    double DistanceKm,
    TimeSpan Duration,
    IReadOnlyList<Coordinates> Geometry);
