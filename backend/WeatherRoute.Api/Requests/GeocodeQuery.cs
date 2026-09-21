namespace WeatherRoute.Api.Requests;

public sealed record GeocodeQuery(string? Q, int Limit = 1);