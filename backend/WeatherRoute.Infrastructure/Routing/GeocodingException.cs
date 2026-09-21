namespace WeatherRoute.Infrastructure.Routing;

public sealed class GeocodingException : Exception
{
    public GeocodingException(string message) : base(message) { }
}