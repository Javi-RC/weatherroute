namespace WeatherRoute.Domain.ValueObjects;

public sealed record Coordinates
{
    public Coordinates(double latitude, double longitude)
    {
        if (latitude is < -90 or > 90)
            throw new ArgumentOutOfRangeException(nameof(latitude), "Latitude must be in [-90, 90].");
        if (longitude is < -180 or > 180)
            throw new ArgumentOutOfRangeException(nameof(longitude), "Longitude must be in [-180, 180].");
        Latitude = latitude;
        Longitude = longitude;
    }

    public double Latitude { get; }
    public double Longitude { get; }

    public double DistanceKmTo(Coordinates other)
    {
        const double r = 6371.0088;
        double dLat = Deg2Rad(other.Latitude - Latitude);
        double dLon = Deg2Rad(other.Longitude - Longitude);
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2)
                 + Math.Cos(Deg2Rad(Latitude)) * Math.Cos(Deg2Rad(other.Latitude))
                 * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return 2 * r * Math.Asin(Math.Min(1, Math.Sqrt(a)));
    }

    private static double Deg2Rad(double deg) => deg * Math.PI / 180;
}
