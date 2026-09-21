using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Xunit;

namespace WeatherRoute.Api.IntegrationTests;

public class ExceptionHandlerTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public ExceptionHandlerTests(WebApplicationFactory<Program> factory) => _factory = factory;

    private WebApplicationFactory<Program> Build() => _factory.WithWebHostBuilder(b =>
    {
        b.UseSetting("Persistence:AutoMigrate", "false");
        b.UseSetting("Test:EnableExceptionProbe", "true");
    });

    [Fact]
    public async Task Unhandled_Exception_Returns_ProblemDetails_500()
    {
        using var factory = Build();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/test/exception/generic");

        Assert.Equal(HttpStatusCode.InternalServerError, resp.StatusCode);
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.Equal(500, doc.RootElement.GetProperty("status").GetInt32());
        Assert.Equal("Internal Server Error", doc.RootElement.GetProperty("title").GetString());
    }

    [Fact]
    public async Task Geocoding_Exception_Returns_NotFound_ProblemDetails()
    {
        using var factory = Build();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/test/exception/geocoding");

        Assert.Equal(HttpStatusCode.NotFound, resp.StatusCode);
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.Equal(404, doc.RootElement.GetProperty("status").GetInt32());
    }

    [Fact]
    public async Task Client_Cancellation_Maps_To_499_Not_500()
    {
        using var factory = Build();
        var client = factory.CreateClient();

        var resp = await client.GetAsync("/test/exception/cancel");

        Assert.Equal((HttpStatusCode)499, resp.StatusCode);
        Assert.Equal("application/problem+json", resp.Content.Headers.ContentType?.MediaType);
        using var doc = JsonDocument.Parse(await resp.Content.ReadAsStringAsync());
        Assert.Equal(499, doc.RootElement.GetProperty("status").GetInt32());
    }
}