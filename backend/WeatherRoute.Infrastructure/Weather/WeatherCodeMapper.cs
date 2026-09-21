using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Infrastructure.Weather;

public static class WeatherCodeMapper
{
    public static WeatherCondition Map(int wmo) => wmo switch
    {
        0 or 1 => WeatherCondition.Clear,
        2 or 3 => WeatherCondition.Clouds,
        45 or 48 => WeatherCondition.Fog,
        >= 51 and <= 67 or >= 80 and <= 82 or 85 or 86 => WeatherCondition.Rain,
        71 or 73 or 75 or 77 => WeatherCondition.Snow,
        95 or 96 or 99 => WeatherCondition.Storm,
        _ => WeatherCondition.Unknown
    };
}