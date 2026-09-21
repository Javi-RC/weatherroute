using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Domain.Services;

public interface IActivityRiskStrategy
{
    ActivityType Activity { get; }
    IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots);
}

public sealed record SnapshotSummary(
    double? MeanTemp, double? MaxWind, double? MaxPrecipProb, int? MaxUv,
    double? MinVisibility, bool WorstWasRain, bool WorstWasStorm, bool WorstWasSnow);

public static class SnapshotSummarizer
{
    public static SnapshotSummary Summarize(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var temps = snapshots.Where(s => s.Temperature is not null).Select(s => s.Temperature!.Celsius).ToList();
        var winds = snapshots.Where(s => s.Wind is not null).Select(s => s.Wind!.Kmh).ToList();
        var probs = snapshots.Where(s => s.PrecipitationProbability is not null).Select(s => s.PrecipitationProbability!.Value).ToList();
        var uvs = snapshots.Where(s => s.UvIndex is not null).Select(s => s.UvIndex!.Value).ToList();
        var vis = snapshots.Where(s => s.VisibilityKm is not null).Select(s => s.VisibilityKm!.Value).ToList();
        bool rain = snapshots.Any(s => s.Condition is WeatherCondition.Rain or WeatherCondition.Snow or WeatherCondition.Storm);
        return new SnapshotSummary(
            temps.Count > 0 ? temps.Average() : null,
            winds.Count > 0 ? winds.Max() : null,
            probs.Count > 0 ? probs.Max() : null,
            uvs.Count > 0 ? uvs.Max() : null,
            vis.Count > 0 ? vis.Min() : null,
            rain,
            snapshots.Any(s => s.Condition == WeatherCondition.Storm),
            snapshots.Any(s => s.Condition == WeatherCondition.Snow));
    }
}

public sealed class CyclingStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Cycling;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MaxWind is { } wind and >= 15)
            factors.Add(Wind("WIND", wind switch { < 25 => 12, < 40 => 25, _ => 55 }, wind));
        if (s.MeanTemp is { } t)
        {
            int p = t is < 0 ? 35 : t is < 5 ? 20 : t is < 10 ? 10 : t is > 40 ? 30 : t is > 35 ? 20 : t is > 30 ? 8 : 0;
            if (p > 0) factors.Add(F("TEMPERATURE", p, $"Temperature {t:0.#}°C"));
        }
        if (s.MaxPrecipProb is { } prob and >= 40)
            factors.Add(F("RAIN", prob switch { < 60 => 10, _ => 20 }, $"{prob:0}% precipitation chance"));
        if (s.WorstWasStorm) factors.Add(F("STORM", 40, "Storm expected"));
        if (s.WorstWasRain) factors.Add(F("RAIN", Math.Max(s.MaxPrecipProb is >= 60 ? 20 : 0, 20), "Rain along the route"));
        if (s.MinVisibility is { } vis and < 1) factors.Add(F("VISIBILITY", 15, $"Visibility {vis:0.#} km"));
        if (s.MaxUv is { } uv and > 6) factors.Add(F("UV", uv switch { > 8 => 15, _ => 10 }, $"UV index {uv}"));
        return Merge(factors);
    }

    public static List<RiskFactor> Merge(IEnumerable<RiskFactor> raw) =>
        raw.GroupBy(f => f.Type)
           .Select(g => g.OrderByDescending(f => f.Contribution).First())
           .ToList();

    public static RiskFactor F(string type, int contribution, string message) =>
        new(type, RiskScoring.FactorLevel(contribution), contribution, message);

    public static RiskFactor Wind(string type, int contribution, double kmh) =>
        new(type, RiskScoring.FactorLevel(contribution), contribution, $"Wind {kmh:0} km/h");
}

public sealed class DrivingStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Driving;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MaxWind is { } wind and >= 45) factors.Add(CyclingStrategy.Wind("WIND", 30, wind));
        if (s.WorstWasStorm) factors.Add(CyclingStrategy.F("STORM", 45, "Storm expected"));
        if (s.WorstWasSnow) factors.Add(CyclingStrategy.F("SNOW", 30, "Snow expected"));
        if (s.WorstWasRain) factors.Add(CyclingStrategy.F("RAIN", 25, "Rain along the route"));
        if (s.MinVisibility is { } vis and < 1) factors.Add(CyclingStrategy.F("VISIBILITY", 25, $"Visibility {vis:0.#} km"));
        return CyclingStrategy.Merge(factors);
    }
}

public sealed class RunningStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Running;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MeanTemp is { } t)
        {
            int p = t is < -5 ? 35 : t < 0 ? 20 : t > 35 ? 25 : t > 30 ? 12 : t > 27 ? 7 : 0;
            if (p > 0) factors.Add(CyclingStrategy.F("HEAT", p, $"Temperature {t:0.#}°C"));
        }
        if (s.MaxWind is { } wind and >= 35) factors.Add(CyclingStrategy.Wind("WIND", 15, wind));
        if (s.WorstWasRain) factors.Add(CyclingStrategy.F("RAIN", 15, "Rain along the route"));
        if (s.MaxUv is { } uv and > 6) factors.Add(CyclingStrategy.F("UV", 10, $"UV index {uv}"));
        return CyclingStrategy.Merge(factors);
    }
}

public sealed class WalkingStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Walking;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MeanTemp is { } t)
        {
            int p = t is < -5 ? 30 : t < 0 ? 15 : t > 38 ? 20 : 0;
            if (p > 0) factors.Add(CyclingStrategy.F("TEMPERATURE", p, $"Temperature {t:0.#}°C"));
        }
        if (s.MaxPrecipProb is { } prob and >= 50) factors.Add(CyclingStrategy.F("RAIN", 10, $"{prob:0}% precipitation chance"));
        if (s.WorstWasStorm) factors.Add(CyclingStrategy.F("STORM", 35, "Storm expected"));
        if (s.MaxUv is { } uv and > 7) factors.Add(CyclingStrategy.F("UV", 8, $"UV index {uv}"));
        if (s.MaxWind is { } wind and >= 45) factors.Add(CyclingStrategy.Wind("WIND", 8, wind));
        return CyclingStrategy.Merge(factors);
    }
}

public sealed class MotorcycleStrategy : IActivityRiskStrategy
{
    public ActivityType Activity => ActivityType.Motorcycle;

    public IReadOnlyList<RiskFactor> Evaluate(IReadOnlyList<WeatherSnapshot> snapshots)
    {
        var s = SnapshotSummarizer.Summarize(snapshots);
        var factors = new List<RiskFactor>();
        if (s.MaxWind is { } wind and >= 35) factors.Add(CyclingStrategy.Wind("WIND", 20, wind));
        if (s.WorstWasStorm) factors.Add(CyclingStrategy.F("STORM", 40, "Storm expected"));
        if (s.WorstWasRain) factors.Add(CyclingStrategy.F("RAIN", 30, "Rain along the route"));
        if (s.MinVisibility is { } vis and < 2) factors.Add(CyclingStrategy.F("VISIBILITY", 15, $"Visibility {vis:0.#} km"));
        if (s.MeanTemp is { } t and (< 5 or > 35)) factors.Add(CyclingStrategy.F("TEMPERATURE", 15, $"Temperature {t:0.#}°C"));
        return CyclingStrategy.Merge(factors);
    }
}