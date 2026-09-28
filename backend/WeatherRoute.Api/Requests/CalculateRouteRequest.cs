using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Api.Requests;

public sealed record CalculateRouteRequest(
    string? Origin,
    string? Destination,
    ActivityType Activity,
    DateTime DepartureTime,
    CoordinatesDto? OriginCoordinates = null,
    CoordinatesDto? DestinationCoordinates = null,
    int? MaxDurationMinutes = null);