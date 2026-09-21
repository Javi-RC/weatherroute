using System.Collections.Generic;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.DependencyInjection;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Infrastructure.Caching;
using Xunit;

namespace WeatherRoute.Api.IntegrationTests;

public class CacheWiringTests : IClassFixture<WebApplicationFactory<Program>>
{
    private readonly WebApplicationFactory<Program> _factory;

    public CacheWiringTests(WebApplicationFactory<Program> factory) => _factory = factory;

    private WebApplicationFactory<Program> Build(Dictionary<string, string> settings) =>
        _factory.WithWebHostBuilder(b =>
        {
            b.UseSetting("Persistence:AutoMigrate", "false");
            foreach (var (key, value) in settings)
                b.UseSetting(key, value);
        });

    [Fact]
    public void InMemory_Provider_Registers_Memory_Cache_And_Decorator()
    {
        using var factory = Build(new Dictionary<string, string>
        {
            ["CachingOptions:Provider"] = "InMemory",
            ["ConnectionStrings:Redis"] = "localhost:6379"
        });
        using var scope = factory.Services.CreateScope();
        var cache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();
        var useCase = scope.ServiceProvider.GetRequiredService<ICalculateRouteUseCase>();

        Assert.Contains("MemoryDistributedCache", cache.GetType().Name);
        Assert.Equal(typeof(CachedCalculateRouteUseCase), useCase.GetType());
    }

    [Fact]
    public void Redis_Provider_Registers_Redis_Cache_And_Decorator()
    {
        var factory = Build(new Dictionary<string, string> { ["CachingOptions:Provider"] = "Redis" });

        using (var scope = factory.Services.CreateScope())
        {
            var cache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();
            var useCase = scope.ServiceProvider.GetRequiredService<ICalculateRouteUseCase>();

            Assert.Contains("RedisCache", cache.GetType().Name);
            Assert.Equal(typeof(CachedCalculateRouteUseCase), useCase.GetType());
        }

        factory.Dispose();
    }

    [Fact]
    public void Redis_Provider_Without_Connection_Falls_Back_To_Memory()
    {
        var factory = Build(new Dictionary<string, string>
        {
            ["CachingOptions:Provider"] = "Redis",
            ["ConnectionStrings:Redis"] = ""
        });

        using (var scope = factory.Services.CreateScope())
        {
            var cache = scope.ServiceProvider.GetRequiredService<IDistributedCache>();

            Assert.Contains("MemoryDistributedCache", cache.GetType().Name);
        }

        factory.Dispose();
    }
}