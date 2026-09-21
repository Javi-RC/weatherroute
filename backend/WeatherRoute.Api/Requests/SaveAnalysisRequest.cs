using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.Requests;

public sealed record SaveAnalysisRequest(
    string Origin,
    string Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    double DistanceKm,
    int DurationMinutes,
    int RiskScore,
    RiskLevel RiskLevel);