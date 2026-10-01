using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261001120000_SplitEnglishLocales")]
public sealed class SplitEnglishLocales : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("UPDATE regional_settings SET default_language = 'en-US' WHERE lower(default_language) = 'en';");

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.Sql("UPDATE regional_settings SET default_language = 'en' WHERE default_language IN ('en-US', 'en-GB');");
}
