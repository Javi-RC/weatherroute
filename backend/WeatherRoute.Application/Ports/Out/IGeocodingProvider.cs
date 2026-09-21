using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Ports.Out;

public interface IGeocodingProvider
{
    Task<Coordinates> GeocodeAsync(string query, CancellationToken ct = default);
}
