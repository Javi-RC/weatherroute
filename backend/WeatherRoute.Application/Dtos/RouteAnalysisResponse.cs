using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Dtos;

public sealed record RouteAnalysisResponse(
    bool WeatherAvailable,
    bool RouteAvailable,
    string? Recommendation,
    IReadOnlyList<RouteCandidate> Routes)
{
    public string Status => WeatherAvailable && RouteAvailable ? "full" : "partial";
}

public sealed record RouteCandidate(
    string ProviderId,
    double DistanceKm,
    int DurationMinutes,
    RiskLevel RiskLevel,
    int RiskScore,
    IReadOnlyList<RiskFactor> Factors,
    IReadOnlyList<SegmentResult> Segments,
    IReadOnlyList<Coordinates> Polyline);

public sealed record SegmentResult(
    int FromIndex,
    int ToIndex,
    double DistanceKm,
    DateTime? ArrivalTimeUtc,
    ExternalWeather? Weather);
