namespace WeatherRoute.Domain.ValueObjects;

public sealed record Distance
{
    public Distance(double km)
    {
        if (km < 0) throw new ArgumentOutOfRangeException(nameof(km), "Distance must be >= 0.");
        Km = km;
    }

    public double Km { get; }
    public static Distance Zero => new(0);
}
