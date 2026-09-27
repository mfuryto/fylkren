using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260920131500_SnapshotAuditActorRole")]
public sealed class SnapshotAuditActorRole : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "actor_was_platform_manager",
            table: "audit_events",
            type: "boolean",
            nullable: false,
            defaultValue: false);

        migrationBuilder.Sql(
            """
            UPDATE audit_events AS audit
            SET actor_was_platform_manager = TRUE
            WHERE EXISTS (
                SELECT 1
                FROM login_identities AS identity
                WHERE identity.person_id = audit.actor_person_id
                  AND identity.is_platform_manager = TRUE
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropColumn(
            name: "actor_was_platform_manager",
            table: "audit_events");
}
