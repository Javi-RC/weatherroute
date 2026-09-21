using WeatherRoute.Application.Ports.In;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Services;

public sealed class DefaultRiskService : IRiskAssessmentService
{
    public RiskAssessment Assess(Route route) => new(RiskLevel.Low, 100, Array.Empty<RiskFactor>());
}
