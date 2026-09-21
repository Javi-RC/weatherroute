using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public interface IRouteRiskEngine
{
    RiskAssessment Assess(ActivityType activity, IReadOnlyList<WeatherSnapshot> snapshots);
}