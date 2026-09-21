using System.Linq;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class RouteRiskEngineTests
{
    private static WeatherSnapshot Clear() =>
        new(new Temperature(20), new Wind(8), 5, 4, 4, WeatherCondition.Clear);

    private static WeatherSnapshot Stormy(double wind = 50) =>
        new(new Temperature(24), new Wind(wind), 90, 3, 2, WeatherCondition.Storm);

    [Fact]
    public void Cycling_Clear_Is_Low_Score_100()
    {
        var engine = new RouteRiskEngine();
        var assessment = engine.Assess(ActivityType.Cycling, new[] { Clear() });

        Assert.Equal(RiskLevel.Low, assessment.Level);
        Assert.Equal(100, assessment.Score);
        Assert.Empty(assessment.Factors);
    }

    [Fact]
    public void Cycling_Strong_Wind_Yields_Wind_Factor_And_Reduced_Score()
    {
        var engine = new RouteRiskEngine();
        var assessment = engine.Assess(ActivityType.Cycling,
            new[] { new WeatherSnapshot(new Temperature(24), new Wind(42), 5, 3, 4, WeatherCondition.Clear) });

        Assert.True(assessment.Score < 100);
        Assert.Contains(assessment.Factors, f => f.Type == "WIND" && f.Contribution == 55); // wind 42 → 55, score 45 → High
        Assert.True(assessment.Level is RiskLevel.High or RiskLevel.Severe);
    }

    [Fact]
    public void Driving_Storm_Is_Severe()
    {
        var engine = new RouteRiskEngine();
        var assessment = engine.Assess(ActivityType.Driving, new[] { Stormy() });

        Assert.Equal(RiskLevel.Severe, assessment.Level);
        Assert.Contains(assessment.Factors, f => f.Type == "STORM");
    }

    [Fact]
    public void Aggregates_Worst_Across_Segments()
    {
        var engine = new RouteRiskEngine();
        var snapshots = new[] { Clear(), Stormy() };

        var assessment = engine.Assess(ActivityType.Motorcycle, snapshots);

        Assert.True(assessment.Score < 60);
        Assert.Equal("MODERATE", assessment.Factors.First(f => f.Type == "WIND").Level);
    }
}