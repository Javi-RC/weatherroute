using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IRouteProvider
{
    Task<IReadOnlyList<ExternalRoute>> CalculateRoutesAsync(
        Coordinates origin,
        Coordinates destination,
        ActivityType activity,
        int alternativeCount,
        CancellationToken ct = default);
}
