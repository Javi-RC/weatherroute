using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WeatherRoute.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Analyses",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uuid", nullable: false),
                    Origin = table.Column<string>(type: "text", nullable: false),
                    Destination = table.Column<string>(type: "text", nullable: false),
                    OriginLat = table.Column<double>(type: "double precision", nullable: false),
                    OriginLon = table.Column<double>(type: "double precision", nullable: false),
                    DestLat = table.Column<double>(type: "double precision", nullable: false),
                    DestLon = table.Column<double>(type: "double precision", nullable: false),
                    Activity = table.Column<int>(type: "integer", nullable: false),
                    DepartureUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false),
                    DistanceKm = table.Column<double>(type: "double precision", nullable: false),
                    DurationMinutes = table.Column<int>(type: "integer", nullable: false),
                    RiskScore = table.Column<int>(type: "integer", nullable: false),
                    RiskLevel = table.Column<int>(type: "integer", nullable: false),
                    CreatedAtUtc = table.Column<DateTime>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Analyses", x => x.Id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Analyses");
        }
    }
}
