using Microsoft.EntityFrameworkCore;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.Out;

namespace WeatherRoute.Infrastructure.Persistence;

public sealed class AnalysisRepository : IAnalysisRepository
{
    private readonly AppDbContext _db;

    public AnalysisRepository(AppDbContext db) => _db = db;

    public async Task<Guid> SaveAsync(RouteAnalysisRecord record, CancellationToken ct = default)
    {
        var entity = new Analysis
        {
            Id = record.Id,
            Origin = record.Origin,
            Destination = record.Destination,
            OriginLat = record.OriginCoordinates.Latitude,
            OriginLon = record.OriginCoordinates.Longitude,
            DestLat = record.DestinationCoordinates.Latitude,
            DestLon = record.DestinationCoordinates.Longitude,
            Activity = record.Activity,
            DepartureUtc = record.DepartureUtc,
            DistanceKm = record.DistanceKm,
            DurationMinutes = record.DurationMinutes,
            RiskScore = record.RiskScore,
            RiskLevel = record.RiskLevel,
            CreatedAtUtc = record.CreatedAtUtc
        };
        _db.Analyses.Add(entity);
        await _db.SaveChangesAsync(ct);
        return entity.Id;
    }

    public async Task<int> CountAsync(CancellationToken ct = default) =>
        await _db.Analyses.CountAsync(ct);
}