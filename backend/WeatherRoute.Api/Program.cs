using System.Text.Json.Serialization;
using FluentValidation;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.Options;
using OpenTelemetry;
using OpenTelemetry.Metrics;
using StackExchange.Redis;
using WeatherRoute.Application.Telemetry;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Application.Services;
using WeatherRoute.Api.Endpoints;
using WeatherRoute.Api.Errors;
using WeatherRoute.Api.Health;
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
builder.Services.AddSingleton<IGeocodingDiscoveryProvider>(sp =>
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
var useRedis = string.Equals(
    builder.Configuration[$"{nameof(CachingOptions)}:Provider"],
    "Redis",
    StringComparison.OrdinalIgnoreCase)
    && !string.IsNullOrWhiteSpace(redis);

if (useRedis)
{
    builder.Services.AddSingleton<IConnectionMultiplexer>(_ =>
        ConnectionMultiplexer.Connect(GetRedisConfigurationOptions(redis!)));
    builder.Services.AddStackExchangeRedisCache(o => o.ConfigurationOptions = GetRedisConfigurationOptions(redis!));
}
else
{
    builder.Services.AddDistributedMemoryCache();
}

builder.Services.AddScoped<WeatherRoute.Application.UseCases.CalculateRouteUseCase>();
builder.Services.AddScoped<ICalculateRouteUseCase>(sp =>
{
    var inner = sp.GetRequiredService<WeatherRoute.Application.UseCases.CalculateRouteUseCase>();
    var cache = sp.GetRequiredService<IDistributedCache>();
    var options = sp.GetRequiredService<IOptions<CachingOptions>>().Value;
    var logger = sp.GetRequiredService<Microsoft.Extensions.Logging.ILogger<CachedCalculateRouteUseCase>>();
    return new CachedCalculateRouteUseCase(inner, cache, options, null, logger);
});

static ConfigurationOptions GetRedisConfigurationOptions(string connectionString)
{
    var options = ConfigurationOptions.Parse(connectionString);
    options.AbortOnConnectFail = false;
    return options;
}

builder.Services.AddWeatherRouteResilience();

builder.Services.AddOpenTelemetry()
    .WithMetrics(m =>
    {
        m.AddMeter(Metrics.MeterName);
        m.AddAspNetCoreInstrumentation();
        m.AddHttpClientInstrumentation();
        m.AddConsoleExporter();
    });

builder.Services.AddProblemDetails();
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddHealthChecks()
    .AddDbContextCheck<AppDbContext>("postgres", tags: ["ready"]);

if (useRedis)
    builder.Services.AddHealthChecks().AddCheck<RedisHealthCheck>(
        "redis",
        failureStatus: HealthStatus.Unhealthy,
        tags: ["ready"]);

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
app.UseExceptionHandler();
app.MapControllers();
app.MapGet("/", () => "WeatherRoute API");
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });                         // liveness
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = r => r.Tags.Contains("ready") }); // readiness
app.MapRouteEndpoints();

if (builder.Configuration.GetValue<bool>("Test:EnableExceptionProbe"))
{
    app.MapGet("/test/exception/{kind}", (string kind) =>
    {
        Exception exception = kind switch
        {
            "cancel" => new OperationCanceledException("client closed request"),
            "geocoding" => new GeocodingException("No geocoding result for 'test'."),
            _ => new InvalidOperationException("boom")
        };
        throw exception;
    });
}

app.Run();

public partial class Program;