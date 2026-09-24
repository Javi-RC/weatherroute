using System;
using System.Linq;
using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Threading.Tasks;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Domain.ValueObjects;
using WeatherRoute.Infrastructure.Routing;

namespace WeatherRoute.Infrastructure.Tests;

public class OpenRouteServiceRoutingAdapterTests
{
    private static OpenRouteServiceRoutingAdapter Build(Func<HttpRequestMessage, string> responder) =>
        new(new HttpClient(new StubHandler(responder))
        {
            BaseAddress = new Uri("https://api.openrouteservice.org")
        }, new OpenRouteServiceOptions { ApiKey = "secret-key" });

    [Fact]
    public async Task Geocodes_First_Feature()
    {
        var adapter = Build(req =>
        {
            Assert.StartsWith("/v2/geocode/search?text=", req.RequestUri!.PathAndQuery);
            Assert.Equal("secret-key", req.Headers.GetValues("Authorization").Single());
            return """
            {"features":[{"geometry":{"type":"Point","coordinates":[-3.929,38.986]}}]}
            """;
        });

        var result = await ((IGeocodingProvider)adapter).GeocodeAsync("Ciudad Real");

        Assert.Equal(38.986, result.Latitude, 3);
        Assert.Equal(-3.929, result.Longitude, 3);
    }

    [Fact]
    public async Task Geocode_Empty_Throws()
    {
        var adapter = Build(_ => """{"features":[]}""");
        await Assert.ThrowsAsync<GeocodingException>(() =>
            ((IGeocodingProvider)adapter).GeocodeAsync("Nada por aqui"));
    }

    [Fact]
    public async Task Routing_Uses_Per_Activity_Profile_And_Returns_Route()
    {
        var adapter = Build(req =>
        {
            Assert.EndsWith("cycling-regular", req.RequestUri!.PathAndQuery);
            using var body = JsonDocument.ParseAsync(req.Content!.ReadAsStreamAsync().Result)
                .ConfigureAwait(false).GetAwaiter().GetResult();
            Assert.True(body.RootElement.TryGetProperty("alternative_routes", out _));
            return """
            {"routes":[
              {
                "summary":{"distance":74200,"duration":10080},
                "geometry":{"type":"LineString","coordinates":[[-3.929,38.986],[-3.912,38.97]]}
              }
            ]}
            """;
        });

        var routes = await ((IRouteProvider)adapter).CalculateRoutesAsync(
            new Coordinates(38.986, -3.929),
            new Coordinates(38.97, -3.912),
            ActivityType.Cycling,
            alternativeCount: 2);

        var route = Assert.Single(routes);
        Assert.Equal(74.2, route.DistanceKm, 1);
        Assert.Equal(TimeSpan.FromHours(2.8), route.Duration,
            (expected, actual) => Math.Abs((actual - expected).TotalSeconds) <= 1);
        Assert.Equal(2, route.Geometry.Count);
        Assert.Equal(38.986, route.Geometry[0].Latitude, 3);
    }

    [Fact]
    public async Task Routing_Api_Errors_Propagate()
    {
        var client = new HttpClient(new StubHandler(_ => throw new HttpRequestException("boom")))
        {
            BaseAddress = new Uri("https://api.openrouteservice.org")
        };
        var adapter = new OpenRouteServiceRoutingAdapter(client, new OpenRouteServiceOptions { ApiKey = "k" });
        _ = await Assert.ThrowsAsync<HttpRequestException>(() =>
            ((IRouteProvider)adapter).CalculateRoutesAsync(
                new Coordinates(0, 0), new Coordinates(1, 1), ActivityType.Driving, 0));
    }

    [Fact]
    public async Task SearchAsync_Parses_Candidates_In_Order()
    {
        var adapter = Build(req =>
        {
            Assert.StartsWith("/v2/geocode/search?text=", req.RequestUri!.PathAndQuery);
            Assert.Equal("secret-key", req.Headers.GetValues("Authorization").Single());
            return """
            {"features":[
              {"properties":{"label":"Ciudad Real, España"},"geometry":{"coordinates":[-3.929,38.986]},"bbox":[-4.0,38.9,-3.8,39.0]},
              {"properties":{"label":"Ciudad Rodrigo, España"},"geometry":{"coordinates":[-6.53,40.6]}}
            ]}
            """;
        });

        var result = await ((IGeocodingDiscoveryProvider)adapter).SearchAsync("Ciudad");

        Assert.Equal(2, result.Count);
        Assert.Equal("Ciudad Real, España", result[0].Label);
        Assert.Equal(38.986, result[0].Latitude, 3);
        Assert.Equal(-3.929, result[0].Longitude, 3);
        Assert.Equal(new[] { -4.0, 38.9, -3.8, 39.0 }, result[0].BoundingBox);
        Assert.Equal("Ciudad Rodrigo, España", result[1].Label);
        Assert.Null(result[1].BoundingBox);
    }

    [Fact]
    public async Task SearchAsync_Caps_At_Six_Candidates()
    {
        var adapter = Build(_ =>
        {
            var features = string.Join(",", Enumerable.Range(0, 10)
                .Select(i => "{\"properties\":{\"label\":\"Place " + i + "\"},\"geometry\":{\"coordinates\":[0," + i + "]}}"));
            return "{\"features\":[" + features + "]}";
        });

        var result = await ((IGeocodingDiscoveryProvider)adapter).SearchAsync("place");

        Assert.Equal(6, result.Count);
        Assert.Equal("Place 0", result[0].Label);
    }

    [Fact]
    public async Task SearchAsync_Empty_Features_Returns_Empty_List()
    {
        var adapter = Build(_ => """{"features":[]}""");

        var result = await ((IGeocodingDiscoveryProvider)adapter).SearchAsync("Nada por aqui");

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetPlaceNameAsync_Returns_Label_From_Reverse_Endpoint()
    {
        var adapter = Build(req =>
        {
            Assert.StartsWith("/v2/geocode/reverse?point.lon=", req.RequestUri!.PathAndQuery);
            Assert.Contains("point.lat=", req.RequestUri!.PathAndQuery);
            Assert.Contains("size=1", req.RequestUri!.PathAndQuery);
            return """{"features":[{"properties":{"label":"Ciudad Real, España"}}]}""";
        });

        var label = await ((IGeocodingDiscoveryProvider)adapter).GetPlaceNameAsync(38.986, -3.929);

        Assert.Equal("Ciudad Real, España", label);
    }

    [Fact]
    public async Task GetPlaceNameAsync_No_Features_Returns_Null()
    {
        var adapter = Build(_ => """{"features":[]}""");

        var label = await ((IGeocodingDiscoveryProvider)adapter).GetPlaceNameAsync(0, 0);

        Assert.Null(label);
    }
}