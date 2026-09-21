using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Services;

public sealed class RouteRiskAssessmentService : IRiskAssessmentService
{
    private readonly IRouteRiskEngine _engine;

    public RouteRiskAssessmentService(IRouteRiskEngine engine) => _engine = engine;

    public RiskAssessment Assess(Route route)
    {
        var snapshots = route.Segments.Where(s => s.HasWeather).Select(s => s.Weather!).ToList();
        return snapshots.Count == 0
            ? new RiskAssessment(Domain.Enums.RiskLevel.Low, 100, Array.Empty<RiskFactor>())
            : _engine.Assess(route.Activity, snapshots);
    }
}