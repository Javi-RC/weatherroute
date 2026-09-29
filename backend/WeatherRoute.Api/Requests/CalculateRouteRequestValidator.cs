using FluentValidation;

namespace WeatherRoute.Api.Requests;

public sealed class CalculateRouteRequestValidator : AbstractValidator<CalculateRouteRequest>
{
    public CalculateRouteRequestValidator()
    {
        RuleFor(x => x.Origin)
            .MaximumLength(200)
            .NotEmpty()
            .When(x => x.OriginCoordinates is null);
        RuleFor(x => x.Destination)
            .MaximumLength(200)
            .NotEmpty()
            .When(x => x.DestinationCoordinates is null);
        RuleFor(x => x.OriginCoordinates)
            .Must(BeValidOrNull)
            .WithMessage("Latitude must be in [-90, 90] and longitude in [-180, 180].");
        RuleFor(x => x.DestinationCoordinates)
            .Must(BeValidOrNull)
            .WithMessage("Latitude must be in [-90, 90] and longitude in [-180, 180].");
        RuleFor(x => x.DepartureTime).NotEmpty();
        RuleFor(x => x.MaxDurationMinutes).GreaterThan(0).When(x => x.MaxDurationMinutes.HasValue);
    }

    private static bool BeValidOrNull(CoordinatesDto? coordinates)
    {
        if (coordinates is null) return true;
        return coordinates.Latitude is >= -90 and <= 90
            && coordinates.Longitude is >= -180 and <= 180;
    }
}
