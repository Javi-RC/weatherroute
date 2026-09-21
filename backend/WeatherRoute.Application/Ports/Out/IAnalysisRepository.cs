using WeatherRoute.Application.Dtos;

namespace WeatherRoute.Application.Ports.Out;

public interface IAnalysisRepository
{
    Task<Guid> SaveAsync(RouteAnalysisRecord record, CancellationToken ct = default);
}
