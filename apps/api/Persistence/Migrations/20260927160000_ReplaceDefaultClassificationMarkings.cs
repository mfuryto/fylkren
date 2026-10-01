using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260927160000_ReplaceDefaultClassificationMarkings")]
public sealed class ReplaceDefaultClassificationMarkings : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DELETE FROM classification_definitions
        WHERE id = '00000000-0000-0000-0000-000000000007'
          AND name IN ('LEGACY_RESTRICTED', CONCAT('BEGREN', 'SET'))
          AND abbreviation IN ('LR', 'B');

        INSERT INTO classification_definitions (id, name, abbreviation, sort_order, is_active)
        VALUES
          ('00000000-0000-0000-0000-000000000007', 'PUBLIC', 'PUB', 10, TRUE),
          ('00000000-0000-0000-0000-000000000008', 'INTERNAL', 'INT', 20, TRUE),
          ('00000000-0000-0000-0000-000000000009', 'CONFIDENTIAL', 'CONF', 30, TRUE),
          ('00000000-0000-0000-0000-000000000010', 'SENSITIVE', 'SENS', 40, TRUE),
          ('00000000-0000-0000-0000-000000000011', 'SECRET', 'SECRET', 50, TRUE)
        ON CONFLICT DO NOTHING;
        """);

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.Sql("""
        DELETE FROM classification_definitions
        WHERE (id, abbreviation) IN (
          ('00000000-0000-0000-0000-000000000007', 'PUB'),
          ('00000000-0000-0000-0000-000000000008', 'INT'),
          ('00000000-0000-0000-0000-000000000009', 'CONF'),
          ('00000000-0000-0000-0000-000000000010', 'SENS'),
          ('00000000-0000-0000-0000-000000000011', 'SECRET'));
        INSERT INTO classification_definitions (id, name, abbreviation, sort_order, is_active)
        VALUES ('00000000-0000-0000-0000-000000000007', 'LEGACY_RESTRICTED', 'LR', 10, TRUE)
        ON CONFLICT DO NOTHING;
        """);
}
