using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public sealed class RouteRiskEngine : IRouteRiskEngine
{
    private readonly IReadOnlyDictionary<ActivityType, IActivityRiskStrategy> _strategies =
        new IActivityRiskStrategy[]
        {
            new CyclingStrategy(), new DrivingStrategy(), new RunningStrategy(),
            new WalkingStrategy(), new MotorcycleStrategy()
        }.ToDictionary(s => s.Activity);

    public RiskAssessment Assess(ActivityType activity, IReadOnlyList<WeatherSnapshot> snapshots)
    {
        if (!_strategies.TryGetValue(activity, out var strategy))
            return new RiskAssessment(RiskLevel.Low, RiskScoring.Max, Array.Empty<RiskFactor>());

        var factors = strategy.Evaluate(snapshots);
        var total = factors.Sum(f => f.Contribution);
        var score = Math.Clamp(RiskScoring.Max - total, 0, RiskScoring.Max);
        return new RiskAssessment(RiskScoring.LevelFromScore(score), score, factors);
    }
}