using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260930100000_AddRegionalSettings")]
public sealed class AddRegionalSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "regional_settings",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                default_language = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                time_zone = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                clock_format = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                measurement_system = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_regional_settings", x => x.id));
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "regional_settings");
}
