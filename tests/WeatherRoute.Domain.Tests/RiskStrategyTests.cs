using System.Linq;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.Services;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class RiskStrategyTests
{
    private static RouteRiskEngine Engine => new();

    private static WeatherSnapshot Snapshot(
        double temp = 20, double wind = 8, double prob = 5, int uv = 3, double vis = 4,
        WeatherCondition condition = WeatherCondition.Clear) =>
        new(new Temperature(temp), new Wind(wind), prob, uv, vis, condition);

    [Fact]
    public void Cycling_Clear_Temperature_In_Range_Is_Score_100()
    {
        var assessment = Engine.Assess(ActivityType.Cycling, new[] { Snapshot() });

        Assert.Equal(100, assessment.Score);
        Assert.Equal(RiskLevel.Low, assessment.Level);
        Assert.Empty(assessment.Factors);
    }

    [Fact]
    public void Cycling_Rain_Condition_Adds_Single_Rain_Factor_Of_20()
    {
        var assessment = Engine.Assess(ActivityType.Cycling,
            new[] { Snapshot(condition: WeatherCondition.Rain, prob: 30, temp: 20, wind: 8) });

        Assert.Equal(80, assessment.Score);
        var rain = assessment.Factors.Where(f => f.Type == "RAIN").ToList();
        Assert.Single(rain);
        Assert.Equal(20, rain[0].Contribution);
    }

    [Fact]
    public void Cycling_Storm_Stacks_Storm_With_Single_Rain_Factor()
    {
        var assessment = Engine.Assess(ActivityType.Cycling,
            new[] { Snapshot(condition: WeatherCondition.Storm, prob: 90, temp: 20, wind: 8) });

        Assert.Contains(assessment.Factors, f => f.Type == "STORM" && f.Contribution == 40);
        var rain = assessment.Factors.Where(f => f.Type == "RAIN").ToList();
        Assert.Single(rain);
        Assert.Equal(20, rain[0].Contribution);
        Assert.Equal(40, assessment.Score);
    }

    [Fact]
    public void Cycling_High_Precipitation_Probability_Without_Condition_Adds_10()
    {
        var assessment = Engine.Assess(ActivityType.Cycling,
            new[] { Snapshot(prob: 50, temp: 20, wind: 8) });

        Assert.Contains(assessment.Factors, f => f.Type == "RAIN" && f.Contribution == 10);
        Assert.Equal(90, assessment.Score);
    }

    [Fact]
    public void Running_Hot_Adds_Heat_Factor()
    {
        var assessment = Engine.Assess(ActivityType.Running,
            new[] { Snapshot(temp: 38, wind: 5, prob: 5) });

        Assert.Contains(assessment.Factors, f => f.Type == "HEAT" && f.Contribution == 25);
        Assert.Equal(75, assessment.Score);
    }

    [Fact]
    public void Running_Cold_Adds_Heat_Factor()
    {
        var assessment = Engine.Assess(ActivityType.Running,
            new[] { Snapshot(temp: -6, wind: 5, prob: 5) });

        Assert.Contains(assessment.Factors, f => f.Type == "HEAT" && f.Contribution == 35);
        Assert.Equal(65, assessment.Score);
    }

    [Fact]
    public void Walking_Storm_Adds_Storm_And_Precipitation_Probability()
    {
        var assessment = Engine.Assess(ActivityType.Walking,
            new[] { Snapshot(condition: WeatherCondition.Storm, prob: 80, temp: 20, wind: 8) });

        Assert.Contains(assessment.Factors, f => f.Type == "STORM" && f.Contribution == 35);
        Assert.Contains(assessment.Factors, f => f.Type == "RAIN" && f.Contribution == 10);
        Assert.Equal(55, assessment.Score);
    }

    [Fact]
    public void Driving_Snow_Adds_Snow_And_Rain_Precipitation()
    {
        var assessment = Engine.Assess(ActivityType.Driving,
            new[] { Snapshot(condition: WeatherCondition.Snow, prob: 70, temp: 20, wind: 10) });

        Assert.Contains(assessment.Factors, f => f.Type == "SNOW" && f.Contribution == 30);
        Assert.Contains(assessment.Factors, f => f.Type == "RAIN" && f.Contribution == 25);
        Assert.Equal(45, assessment.Score);
    }

    [Fact]
    public void Motorcycle_Low_Visibility_Adds_Factor()
    {
        var assessment = Engine.Assess(ActivityType.Motorcycle,
            new[] { Snapshot(temp: 20, wind: 8, prob: 5, vis: 1.5) });

        Assert.Contains(assessment.Factors, f => f.Type == "VISIBILITY" && f.Contribution == 15);
        Assert.Equal(85, assessment.Score);
    }

    [Fact]
    public void Summarizer_HasPrecipitation_Is_True_For_Any_Precipitation_Condition()
    {
        Assert.False(SnapshotSummarizer.Summarize(new[] { Snapshot(condition: WeatherCondition.Clear) }).HasPrecipitation);
        Assert.False(SnapshotSummarizer.Summarize(new[] { Snapshot(condition: WeatherCondition.Clouds) }).HasPrecipitation);
        Assert.True(SnapshotSummarizer.Summarize(new[] { Snapshot(condition: WeatherCondition.Rain) }).HasPrecipitation);
        Assert.True(SnapshotSummarizer.Summarize(new[] { Snapshot(condition: WeatherCondition.Snow) }).HasPrecipitation);
        Assert.True(SnapshotSummarizer.Summarize(new[] { Snapshot(condition: WeatherCondition.Storm) }).HasPrecipitation);
    }
}