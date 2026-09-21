using WeatherRoute.Domain.ValueObjects;

namespace WeatherRoute.Domain.Tests;

public class SmokeTests
{
    [Fact]
    public void Domain_Assembly_Resolves()
    {
        var coordinates = new Coordinates(0, 0);
        Assert.NotNull(coordinates);
    }
}
