using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Application.Services;

public static class ActivityPace
{
    public static double GetKmh(ActivityType activity) => activity switch
    {
        ActivityType.Walking => 5,
        ActivityType.Running => 10,
        ActivityType.Cycling => 20,
        ActivityType.Motorcycle => 60,
        ActivityType.Driving => 60,
        _ => 20
    };
}