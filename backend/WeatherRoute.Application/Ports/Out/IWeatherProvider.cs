using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IWeatherProvider
{
    Task<ExternalWeather?> GetForecastAsync(
        Coordinates coordinates,
        DateTime timestampUtc,
        CancellationToken ct = default);
}
