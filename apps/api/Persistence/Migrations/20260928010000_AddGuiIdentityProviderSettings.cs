using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260928010000_AddGuiIdentityProviderSettings")]
public sealed class AddGuiIdentityProviderSettings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.CreateTable(
        name: "identity_provider_settings",
        columns: table => new
        {
            provider = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
            enabled = table.Column<bool>(type: "boolean", nullable: false),
            protected_configuration = table.Column<string>(type: "text", nullable: false),
            updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            last_tested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
            last_test_succeeded = table.Column<bool>(type: "boolean", nullable: true),
            last_test_error = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
        },
        constraints: table => table.PrimaryKey("PK_identity_provider_settings", value => value.provider));

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "identity_provider_settings");
}
