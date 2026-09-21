using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Api.Requests;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Persistence;

namespace WeatherRoute.Api.Endpoints;

public static class RouteEndpoints
{
    public static void MapRouteEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api").WithTags("routes");

        group.MapPost("/routes/analyze", async (
            CalculateRouteRequest request,
            ICalculateRouteUseCase useCase,
            IValidator<CalculateRouteRequest> validator,
            CancellationToken ct) =>
        {
            var validation = await validator.ValidateAsync(request, ct);
            if (!validation.IsValid)
                return Results.ValidationProblem(validation.ToDictionary());
            var command = new CalculateRouteCommand(request.Origin, request.Destination,
                request.Activity, request.DepartureTime.Kind == DateTimeKind.Utc
                    ? request.DepartureTime
                    : DateTime.SpecifyKind(request.DepartureTime, DateTimeKind.Utc),
                request.MaxDurationMinutes);
            var result = await useCase.ExecuteAsync(command, ct);
            return Results.Ok(result);
        });

        group.MapGet("/geocode", async (
            [FromQuery] string? q,
            IGeocodingProvider geocoding,
            CancellationToken ct) =>
        {
            if (string.IsNullOrWhiteSpace(q)) return Results.BadRequest(new { error = "Missing q." });
            var coord = await geocoding.GeocodeAsync(q, ct);
            return Results.Ok(new { query = q, coordinates = new { lat = coord.Latitude, lon = coord.Longitude } });
        });

        group.MapPost("/routes/analyses", async (
            SaveAnalysisRequest request,
            IGeocodingProvider geocoding,
            IAnalysisRepository repository,
            CancellationToken ct) =>
        {
            var originCoord = await geocoding.GeocodeAsync(request.Origin, ct);
            var destinationCoord = await geocoding.GeocodeAsync(request.Destination, ct);
            var record = new RouteAnalysisRecord(
                Guid.NewGuid(), request.Origin, request.Destination,
                originCoord, destinationCoord,
                request.Activity,
                request.DepartureTime.Kind == DateTimeKind.Utc ? request.DepartureTime : DateTime.SpecifyKind(request.DepartureTime, DateTimeKind.Utc),
                request.DistanceKm, request.DurationMinutes, request.RiskScore, request.RiskLevel,
                DateTime.UtcNow);
            var id = await repository.SaveAsync(record, ct);
            return Results.Created($"/api/routes/analyses/{id}", new { id });
        });
    }
}