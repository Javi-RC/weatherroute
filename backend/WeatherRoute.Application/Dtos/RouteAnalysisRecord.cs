using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Dtos;

public sealed record RouteAnalysisRecord(
    Guid Id,
    string Origin,
    string Destination,
    Coordinates OriginCoordinates,
    Coordinates DestinationCoordinates,
    ActivityType Activity,
    DateTime DepartureUtc,
    double DistanceKm,
    int DurationMinutes,
    int RiskScore,
    RiskLevel RiskLevel,
    DateTime CreatedAtUtc);
