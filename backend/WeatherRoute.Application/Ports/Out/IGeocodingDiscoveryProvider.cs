using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IGeocodingDiscoveryProvider
{
    Task<IReadOnlyList<GeocodingCandidate>> SearchAsync(string query, CancellationToken ct = default);

    Task<string?> GetPlaceNameAsync(double latitude, double longitude, CancellationToken ct = default);
}
