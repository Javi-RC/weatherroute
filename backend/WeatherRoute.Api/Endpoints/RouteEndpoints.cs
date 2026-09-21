using FluentValidation;
using Microsoft.AspNetCore.Mvc;
using WeatherRoute.Application.Dtos;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Api.Requests;

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
            try
            {
                var coord = await geocoding.GeocodeAsync(q, ct);
                return Results.Ok(new { query = q, coordinates = new { lat = coord.Latitude, lon = coord.Longitude } });
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                return Results.NotFound(new { error = ex.Message });
            }
        });
    }
}