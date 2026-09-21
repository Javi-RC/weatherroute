using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace WeatherRoute.Infrastructure.Persistence;

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddWeatherRoutePersistence(this IServiceCollection services, IConfiguration config)
    {
        var connection = config.GetConnectionString("DefaultConnection")!;
        services.AddDbContext<AppDbContext>(o => o.UseNpgsql(connection));
        services.AddScoped<Application.Ports.Out.IAnalysisRepository, AnalysisRepository>();
        return services;
    }
}