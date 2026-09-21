using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using WeatherRoute.Application.Telemetry;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Application.Services;
using WeatherRoute.Api.Endpoints;
using WeatherRoute.Api.Requests;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Infrastructure.Caching;
using WeatherRoute.Infrastructure.Persistence;
using WeatherRoute.Infrastructure.Resilience;
using WeatherRoute.Infrastructure.Routing;
using WeatherRoute.Infrastructure.Weather;
using WeatherRoute.Domain.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<OpenRouteServiceOptions>(
    builder.Configuration.GetSection(nameof(OpenRouteServiceOptions)));
builder.Services.Configure<CachingOptions>(
    builder.Configuration.GetSection(nameof(CachingOptions)));

builder.Services.AddTransient<IRouteSampler, RouteSampler>();
builder.Services.AddSingleton<IRouteRiskEngine, RouteRiskEngine>();
builder.Services.AddTransient<IRiskAssessmentService, RouteRiskAssessmentService>();
builder.Services.AddSingleton<IGeocodingProvider>(sp =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenRouteServiceOptions>>().Value;
    return new OpenRouteServiceRoutingAdapter(sp.GetRequiredService<IHttpClientFactory>().CreateClient("ors"), options);
});
builder.Services.AddSingleton<IRouteProvider>(sp =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenRouteServiceOptions>>().Value;
    return new OpenRouteServiceRoutingAdapter(sp.GetRequiredService<IHttpClientFactory>().CreateClient("ors"), options);
});
builder.Services.AddTransient<IWeatherProvider>(sp =>
{
    var http = sp.GetRequiredService<IHttpClientFactory>().CreateClient("open-meteo");
    http.BaseAddress = new Uri("https://api.open-meteo.com");
    return new OpenMeteoWeatherAdapter(http);
});

var redis = builder.Configuration.GetConnectionString("Redis");
if (string.IsNullOrWhiteSpace(redis))
    builder.Services.AddDistributedMemoryCache();
else
    builder.Services.AddStackExchangeRedisCache(o => o.Configuration = redis);

builder.Services.AddScoped<WeatherRoute.Application.UseCases.CalculateRouteUseCase>();
builder.Services.AddScoped<ICalculateRouteUseCase>(sp =>
{
    var inner = sp.GetRequiredService<WeatherRoute.Application.UseCases.CalculateRouteUseCase>();
    var cache = sp.GetRequiredService<Microsoft.Extensions.Caching.Distributed.IDistributedCache>();
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<CachingOptions>>().Value;
    return string.Equals(options.Provider, "Redis", StringComparison.OrdinalIgnoreCase)
        ? new CachedCalculateRouteUseCase(inner, cache, options)
        : inner;
});

builder.Services.AddWeatherRouteResilience();

builder.Services.AddOpenTelemetry()
    .WithMetrics(m =>
    {
        m.AddMeter(Metrics.MeterName);
        m.AddAspNetCoreInstrumentation();
        m.AddHttpClientInstrumentation();
        m.AddConsoleExporter();
    });

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("postgres", tags: ["ready"]);

builder.Services.AddValidatorsFromAssemblyContaining<CalculateRouteRequestValidator>();

builder.Services.AddWeatherRoutePersistence(builder.Configuration);

var frontend = builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173";
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(frontend).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();
if (builder.Configuration.GetValue<bool>("Persistence:AutoMigrate", true))
{
    try
    {
        using var scope = app.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        db.Database.Migrate();
    }
    catch (Exception ex)
    {
        app.Logger.LogWarning(ex, "Database migration skipped.");
    }
}
app.UseCors();
app.MapControllers();
app.MapGet("/", () => "WeatherRoute API");
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });                         // liveness
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = r => r.Tags.Contains("ready") }); // readiness
app.MapRouteEndpoints();
app.Run();

public partial class Program;