using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260919190000_AddClassificationAdministration")]
public sealed class AddClassificationAdministration : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "classification_definitions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                abbreviation = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                sort_order = table.Column<int>(type: "integer", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_classification_definitions", x => x.id));

        migrationBuilder.CreateTable(
            name: "classification_settings",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                is_enabled = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_classification_settings", x => x.id));

        migrationBuilder.CreateIndex(
            name: "IX_classification_definitions_abbreviation",
            table: "classification_definitions",
            column: "abbreviation",
            unique: true);

        migrationBuilder.Sql("""
            INSERT INTO classification_settings (id, is_enabled)
            VALUES ('00000000-0000-0000-0000-000000000006', TRUE);

            INSERT INTO classification_definitions (id, name, abbreviation, sort_order, is_active)
            VALUES ('00000000-0000-0000-0000-000000000007', 'BEGRENSET', 'B', 10, TRUE);
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "classification_definitions");
        migrationBuilder.DropTable(name: "classification_settings");
    }
}
