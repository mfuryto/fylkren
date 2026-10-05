using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Infrastructure;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261005220000_AddBrowserSessionRegistry")]
public partial class AddBrowserSessionRegistry : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "browser_sessions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                login_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
                security_version = table.Column<long>(type: "bigint", nullable: false),
                authentication_method = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                user_agent = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_browser_sessions", value => value.id);
                table.ForeignKey(
                    name: "FK_browser_sessions_login_identities_login_identity_id",
                    column: value => value.login_identity_id,
                    principalTable: "login_identities",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex(
            name: "IX_browser_sessions_login_identity_id_revoked_at_expires_at",
            table: "browser_sessions",
            columns: new[] { "login_identity_id", "revoked_at", "expires_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "browser_sessions");
}
