using WeatherRoute.Domain.Enums;
using WeatherRoute.Infrastructure.Weather;
using Xunit;

namespace WeatherRoute.Infrastructure.Tests;

public class WeatherCodeMapperTests
{
    [Theory]
    [InlineData(0, WeatherCondition.Clear)]
    [InlineData(1, WeatherCondition.Clear)]
    [InlineData(2, WeatherCondition.Clouds)]
    [InlineData(3, WeatherCondition.Clouds)]
    [InlineData(45, WeatherCondition.Fog)]
    [InlineData(48, WeatherCondition.Fog)]
    [InlineData(51, WeatherCondition.Rain)]
    [InlineData(63, WeatherCondition.Rain)]
    [InlineData(66, WeatherCondition.Rain)]
    [InlineData(67, WeatherCondition.Rain)]
    [InlineData(80, WeatherCondition.Rain)]
    [InlineData(82, WeatherCondition.Rain)]
    [InlineData(85, WeatherCondition.Rain)]
    [InlineData(86, WeatherCondition.Rain)]
    [InlineData(71, WeatherCondition.Snow)]
    [InlineData(73, WeatherCondition.Snow)]
    [InlineData(75, WeatherCondition.Snow)]
    [InlineData(77, WeatherCondition.Snow)]
    [InlineData(95, WeatherCondition.Storm)]
    [InlineData(96, WeatherCondition.Storm)]
    [InlineData(99, WeatherCondition.Storm)]
    [InlineData(200, WeatherCondition.Unknown)]
    [InlineData(-1, WeatherCondition.Unknown)]
    public void Maps_Wmo_Codes(int code, WeatherCondition expected) =>
        Assert.Equal(expected, WeatherCodeMapper.Map(code));
}