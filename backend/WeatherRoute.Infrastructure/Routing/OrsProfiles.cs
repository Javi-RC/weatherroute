using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Infrastructure.Routing;

public static class OrsProfiles
{
    public static string Map(ActivityType activity) => activity switch
    {
        ActivityType.Walking or ActivityType.Running => "foot-walking",
        ActivityType.Cycling => "cycling-regular",
        ActivityType.Motorcycle => "driving-motorcycle",
        ActivityType.Driving => "driving-car",
        _ => throw new ArgumentOutOfRangeException(nameof(activity), activity, null)   };
}