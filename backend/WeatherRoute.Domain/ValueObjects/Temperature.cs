namespace WeatherRoute.Domain.ValueObjects;

public sealed record Temperature
{
    public Temperature(double celsius)
    {
        if (celsius is < -90 or > 60) throw new ArgumentOutOfRangeException(nameof(celsius));
        Celsius = celsius;
    }

    public double Celsius { get; }
}
