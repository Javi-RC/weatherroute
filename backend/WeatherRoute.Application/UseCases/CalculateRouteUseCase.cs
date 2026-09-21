using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Application.Services;
using WeatherRoute.Domain.Entities;
using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Application.UseCases;

public sealed class CalculateRouteUseCase : ICalculateRouteUseCase
{
    private readonly IGeocodingProvider _geocoding;
    private readonly IRouteProvider _routes;
    private readonly IWeatherProvider _weather;
    private readonly IRouteSampler _sampler;
    private readonly IRiskAssessmentService _risk;

    public CalculateRouteUseCase(
        IGeocodingProvider geocoding,
        IRouteProvider routes,
        IWeatherProvider weather,
        IRouteSampler sampler,
        IRiskAssessmentService risk)
    {
        _geocoding = geocoding;
        _routes = routes;
        _weather = weather;
        _sampler = sampler;
        _risk = risk;
    }

    public async Task<RouteAnalysisResponse> ExecuteAsync(CalculateRouteCommand command, CancellationToken ct = default)
    {
        try
        {
            var origin = await _geocoding.GeocodeAsync(command.Origin, ct);
            var destination = await _geocoding.GeocodeAsync(command.Destination, ct);
            var external = await _routes.CalculateRoutesAsync(origin, destination, command.Activity, 2, ct);

            var candidates = new List<RouteCandidate>();
            bool anyWeather = false;
            foreach (var ext in external)
            {
                var route = _sampler.Sample(ext, command.Activity, command.DepartureTimeUtc);
                var segments = new List<SegmentResult>();
                bool hasWeather = false;

                foreach (var seg in route.Segments)
                {
                    var arrivalUtc = command.DepartureTimeUtc.Add(seg.ArrivalTime ?? TimeSpan.Zero);
                    var midpoint = new Coordinates(
                        (seg.Start.Latitude + seg.End.Latitude) / 2,
                        (seg.Start.Longitude + seg.End.Longitude) / 2);
                    ExternalWeather? weather = null;
                    try
                    {
                        weather = await _weather.GetForecastAsync(midpoint, arrivalUtc, ct);
                    }
                    catch (Exception ex) when (ex is not OperationCanceledException)
                    {
                        weather = null;
                    }
                    if (weather is not null)
                    {
                        hasWeather = true;
                        seg.AssignWeather(new WeatherSnapshot(
                            weather.TemperatureC is { } tempC ? new Temperature(tempC) : null,
                            weather.WindKmh is { } windKmh ? new Wind(windKmh) : null,
                            weather.PrecipitationProbability,
                            weather.UvIndex,
                            weather.VisibilityKm,
                            weather.Condition));
                    }

                    segments.Add(new SegmentResult(seg.StartPointIndex, seg.EndPointIndex, seg.Distance.Km,
                        arrivalUtc, weather));
                }

                anyWeather |= hasWeather;
                var risk = _risk.Assess(route);
                var polyline = route.Geometry
                    .Select(p => new Coordinates(p.Latitude, p.Longitude))
                    .ToList();
                candidates.Add(new RouteCandidate(ext.ProviderId, route.TotalDistance.Km,
                    (int)Math.Ceiling(route.TotalDuration.TotalMinutes), risk.Level, risk.Score,
                    risk.Factors, segments, polyline));
            }

            if (command.MaxDurationMinutes is { } max)
                candidates = candidates.Where(c => c.DurationMinutes <= max).ToList();

            var recommendation = Recommend(candidates);
            return new RouteAnalysisResponse(anyWeather, candidates.Count > 0, recommendation, candidates);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            return new RouteAnalysisResponse(false, false, null, Array.Empty<RouteCandidate>());
        }
    }

    private static string? Recommend(IReadOnlyList<RouteCandidate> candidates)
    {
        if (candidates.Count == 0) return null;
        var best = candidates
            .OrderByDescending(c => c.RiskScore)
            .ThenBy(c => c.DurationMinutes)
            .First();
        int index = candidates.ToList().IndexOf(best) + 1;
        return $"Route #{index}: {best.DistanceKm:0.#} km, {best.DurationMinutes} min, risk {best.RiskLevel}.";
    }
}
