using WeatherRoute.Application.Dtos;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.Services;

public sealed class RouteSampler : IRouteSampler
{
    private const double SegmentKm = 10.0;
    private const int MaxSamples = 20;

    public Route Sample(ExternalRoute route, ActivityType activity, DateTime departureUtc)
    {
        double speed = ActivityPace.GetKmh(activity);
        var geometry = route.Geometry;
        var samples = new List<(Coordinates Point, double CumulativeKm)> { (geometry[0], 0) };

        double cum = 0;
        double target = SegmentKm;
        for (int i = 1; i < geometry.Count && samples.Count < MaxSamples; i++)
        {
            cum += geometry[i - 1].DistanceKmTo(geometry[i]);
            if (cum >= target)
            {
                samples.Add((geometry[i], cum));
                target += SegmentKm;
            }
        }
        if (samples.Count < 2 || samples[^1].Point != geometry[^1])
        {
            if (samples.Count < MaxSamples)
                samples.Add((geometry[^1], cum));
            else
                samples[^1] = (geometry[^1], cum);
        }

        var segments = new List<RouteSegment>(samples.Count - 1);
        double prevKm = 0;
        TimeSpan elapsed = TimeSpan.Zero;
        for (int i = 1; i < samples.Count; i++)
        {
            double km = samples[i].CumulativeKm - prevKm;
            double hours = km / speed;
            var duration = TimeSpan.FromHours(hours);
            var seg = new RouteSegment(
                samples[i - 1].Point, samples[i].Point,
                new Distance(km), duration, i - 1, i);
            seg.SetArrival(elapsed + duration);
            segments.Add(seg);
            elapsed += duration;
            prevKm = samples[i].CumulativeKm;
        }

        var sampledGeometry = samples.Select(s => s.Point).ToList();
        return new Route(activity, segments, sampledGeometry);
    }
}