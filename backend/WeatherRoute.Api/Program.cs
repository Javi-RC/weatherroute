var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();
app.MapGet("/", () => "WeatherRoute API");
app.Run();

public partial class Program;