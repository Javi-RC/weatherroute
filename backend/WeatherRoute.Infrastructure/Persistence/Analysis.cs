using WeatherRoute.Domain.Enums;

namespace WeatherRoute.Infrastructure.Persistence;

public sealed class Analysis
{
    public Guid Id { get; set; }
    public string Origin { get; set; } = "";
    public string Destination { get; set; } = "";
    public double OriginLat { get; set; }
    public double OriginLon { get; set; }
    public double DestLat { get; set; }
    public double DestLon { get; set; }
    public ActivityType Activity { get; set; }
    public DateTime DepartureUtc { get; set; }
    public double DistanceKm { get; set; }
    public int DurationMinutes { get; set; }
    public int RiskScore { get; set; }
    public RiskLevel RiskLevel { get; set; }
    public DateTime CreatedAtUtc { get; set; }
}