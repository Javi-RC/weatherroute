using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Ports.In;

public interface ICalculateRouteUseCase
{
    Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default);
}

public sealed record CalculateRouteCommand(
    string? Origin,
    string? Destination,
    Coordinates? OriginCoordinates,
    Coordinates? DestinationCoordinates,
    ActivityType Activity,
    DateTime DepartureTimeUtc,
    int? MaxDurationMinutes = null);
