using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Services;

namespace WeatherRoute.Application.Ports.In;

public interface IRiskAssessmentService
{
    RiskAssessment Assess(Route route);
}
