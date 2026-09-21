using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public sealed record RiskFactor(string Type, string Level, int Contribution, string Message);

public sealed class RiskAssessment
{
    public RiskAssessment(RiskLevel level, int score, IReadOnlyList<RiskFactor> factors)
    {
        Level = level;
        Score = score;
        Factors = factors;
    }

    public RiskLevel Level { get; }
    public int Score { get; }
    public IReadOnlyList<RiskFactor> Factors { get; }
}
