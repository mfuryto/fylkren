using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260927184000_AddBrandingCustomCss")]
public sealed class AddBrandingCustomCss : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.AddColumn<string>(
            name: "custom_css",
            table: "branding_settings",
            type: "character varying(20000)",
            maxLength: 20000,
            nullable: false,
            defaultValue: "");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(name: "custom_css", table: "branding_settings");
}
