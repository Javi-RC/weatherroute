using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Services;

public interface IRouteSampler
{
    Route Sample(ExternalRoute route, ActivityType activity, DateTime departureUtc);
}