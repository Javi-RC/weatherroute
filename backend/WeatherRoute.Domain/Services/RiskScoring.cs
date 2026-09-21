using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public static class RiskScoring
{
    public const int Max = 100;

    public static RiskLevel LevelFromScore(int score) => score switch
    {
        >= 76 => RiskLevel.Low,
        >= 51 => RiskLevel.Moderate,
        >= 26 => RiskLevel.High,
        _ => RiskLevel.Severe
    };

    public static string FactorLevel(int contribution) => contribution switch
    {
        < 15 => "LOW",
        < 30 => "MODERATE",
        < 50 => "HIGH",
        _ => "SEVERE"
    };
}