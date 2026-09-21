using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Ports.In;

public interface ICalculateRouteUseCase
{
    Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default);
}

public sealed record CalculateRouteCommand(
    string Origin,
    string Destination,
    ActivityType Activity,
    DateTime DepartureTimeUtc,
    int? MaxDurationMinutes = null);
