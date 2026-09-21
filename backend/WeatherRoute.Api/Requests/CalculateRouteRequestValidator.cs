using FluentValidation;

namespace WeatherRoute.Api.Requests;

public sealed class CalculateRouteRequestValidator : AbstractValidator<CalculateRouteRequest>
{
    public CalculateRouteRequestValidator()
    {
        RuleFor(x => x.Origin).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Destination).NotEmpty().MaximumLength(200);
        RuleFor(x => x.DepartureTime).NotEmpty();
        RuleFor(x => x.MaxDurationMinutes).GreaterThan(0).When(x => x.MaxDurationMinutes.HasValue);
    }
}