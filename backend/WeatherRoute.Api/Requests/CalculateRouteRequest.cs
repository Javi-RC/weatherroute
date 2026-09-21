using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.Requests;

public sealed record CalculateRouteRequest(
    string Origin,
    string Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    int? MaxDurationMinutes = null);