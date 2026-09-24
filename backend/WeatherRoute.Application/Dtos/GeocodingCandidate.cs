namespace WeatherRoute.Application.Dtos;

public sealed record GeocodingCandidate(
    string Label,
    double Latitude,
    double Longitude,
    IReadOnlyList<double>? BoundingBox = null);
