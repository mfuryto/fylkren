using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260927185000_RemoveSystemClassificationDefaults")]
public sealed class RemoveSystemClassificationDefaults : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DELETE FROM classification_definitions
        WHERE (id, name, abbreviation) IN (
          ('00000000-0000-0000-0000-000000000007', 'PUBLIC', 'PUB'),
          ('00000000-0000-0000-0000-000000000008', 'INTERNAL', 'INT'),
          ('00000000-0000-0000-0000-000000000009', 'CONFIDENTIAL', 'CONF'),
          ('00000000-0000-0000-0000-000000000010', 'SENSITIVE', 'SENS'),
          ('00000000-0000-0000-0000-000000000011', 'SECRET', 'SECRET'));

        UPDATE classification_settings
        SET is_enabled = FALSE
        WHERE id = '00000000-0000-0000-0000-000000000006'
          AND NOT EXISTS (SELECT 1 FROM classification_definitions);
        """);

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Customer-owned classification registers are never repopulated by rollback.
    }
}
