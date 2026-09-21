using System.Net;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace WeatherRoute.Api.IntegrationTests;

public class ApiSmokeTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ApiSmokeTests(WebApplicationFactory<Program> factory) =>
        _factory = factory.WithWebHostBuilder(b => b.UseSetting("Persistence:AutoMigrate", "false"));

    [Fact]
    public async Task Health_Returns_Ok()
    {
        using var client = _factory.CreateClient();
        var response = await client.GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Root_Returns_Api_Name()
    {
        using var client = _factory.CreateClient();
        var body = await client.GetStringAsync("/");
        Assert.Equal("WeatherRoute API", body);
    }
}