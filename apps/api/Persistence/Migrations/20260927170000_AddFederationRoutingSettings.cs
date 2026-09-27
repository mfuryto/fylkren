using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260927170000_AddFederationRoutingSettings")]
public sealed class AddFederationRoutingSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "federation_routing_settings",
            columns: table => new
            {
                key = table.Column<int>(type: "integer", nullable: false),
                enabled = table.Column<bool>(type: "boolean", nullable: false),
                changed_by = table.Column<Guid>(type: "uuid", nullable: true),
                changed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_federation_routing_settings", value => value.key));

        migrationBuilder.Sql("""
            INSERT INTO federation_routing_settings (key, enabled, changed_at, changed_by)
            VALUES (1, FALSE, TIMESTAMPTZ '1970-01-01 00:00:00+00', NULL);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "federation_routing_settings");
}
