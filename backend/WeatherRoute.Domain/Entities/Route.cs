using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Entities;

public sealed class Route
{
    public Route(ActivityType activity, IReadOnlyList<RouteSegment> segments, IReadOnlyList<Coordinates> geometry)
    {
        Activity = activity;
        Segments = segments;
        Geometry = geometry;
    }

    public ActivityType Activity { get; }
    public IReadOnlyList<RouteSegment> Segments { get; }
    public IReadOnlyList<Coordinates> Geometry { get; }
    public Distance TotalDistance => new(Segments.Sum(s => s.Distance.Km));
    public TimeSpan TotalDuration => Segments.Aggregate(TimeSpan.Zero, (acc, s) => acc + s.EstimatedDuration);
}
