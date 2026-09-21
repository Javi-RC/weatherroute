namespace WeatherRoute.Domain.ValueObjects;

public sealed record Wind
{
    public Wind(double kmh)
    {
        if (kmh < 0) throw new ArgumentOutOfRangeException(nameof(kmh), "Wind must be >= 0.");
        Kmh = kmh;
    }

    public double Kmh { get; }
}
