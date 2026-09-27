using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260923170000_AddInstalledLicense")]
public partial class AddInstalledLicense : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "installed_license",
            columns: table => new
            {
                key = table.Column<int>(type: "integer", nullable: false),
                payload = table.Column<string>(type: "character varying(24000)", maxLength: 24_000, nullable: false),
                signature = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
                imported_by = table.Column<Guid>(type: "uuid", nullable: false),
                imported_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_installed_license", x => x.key));
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("installed_license");
}
