using Microsoft.EntityFrameworkCore;

namespace WeatherRoute.Infrastructure.Persistence;

public sealed class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Analysis> Analyses => Set<Analysis>();
}