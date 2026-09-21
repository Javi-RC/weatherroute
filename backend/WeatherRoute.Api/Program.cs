using System.Text.Json.Serialization;
using FluentValidation;
using WeatherRoute.Application.Ports.In;
using WeatherRoute.Application.Ports.Out;
using WeatherRoute.Application.Services;
using WeatherRoute.Api.Endpoints;
using WeatherRoute.Api.Requests;
using WeatherRoute.Domain.Enums;
using WeatherRoute.Infrastructure.Routing;
using WeatherRoute.Infrastructure.Weather;
using WeatherRoute.Domain.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<OpenRouteServiceOptions>(
    builder.Configuration.GetSection(nameof(OpenRouteServiceOptions)));

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
builder.Services.AddTransient<IWeatherProvider>(_ => new OpenMeteoWeatherAdapter(new HttpClient
{
    BaseAddress = new Uri("https://api.open-meteo.com")
}));
builder.Services.AddScoped<ICalculateRouteUseCase, WeatherRoute.Application.UseCases.CalculateRouteUseCase>();

builder.Services.AddHttpClient("ors", (sp, client) =>
{
    var options = sp.GetRequiredService<Microsoft.Extensions.Options.IOptions<OpenRouteServiceOptions>>().Value;
    client.BaseAddress = new Uri(options.BaseUrl);
});

builder.Services.AddValidatorsFromAssemblyContaining<CalculateRouteRequestValidator>();

var frontend = builder.Configuration["FrontendOrigin"] ?? "http://localhost:5173";
builder.Services.AddCors(o => o.AddDefaultPolicy(p => p.WithOrigins(frontend).AllowAnyHeader().AllowAnyMethod()));

builder.Services.AddControllers().AddJsonOptions(o =>
    o.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter()));
builder.Services.ConfigureHttpJsonOptions(o => o.SerializerOptions.Converters.Add(new JsonStringEnumConverter()));

var app = builder.Build();
app.UseCors();
app.MapControllers();
app.MapGet("/", () => "WeatherRoute API");
app.MapGet("/health", () => Results.Ok(new { status = "ok" }));
app.MapRouteEndpoints();
app.Run();

public partial class Program;