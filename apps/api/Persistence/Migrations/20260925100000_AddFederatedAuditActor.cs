using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260925100000_AddFederatedAuditActor")]
public partial class AddFederatedAuditActor : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<Guid>("actor_person_id", "audit_events", "uuid", nullable: true,
            oldClrType: typeof(Guid), oldType: "uuid");
        migrationBuilder.AddColumn<Guid>("actor_instance_id", "audit_events", "uuid", nullable: true);
        migrationBuilder.AddColumn<Guid>("actor_site_id", "audit_events", "uuid", nullable: true);
        migrationBuilder.AddColumn<string>("actor_site_name", "audit_events", "character varying(200)",
            maxLength: 200, nullable: true);
        migrationBuilder.AddCheckConstraint("CK_audit_events_actor_origin", "audit_events",
            "(actor_person_id IS NOT NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND NULLIF(BTRIM(actor_site_name), '') IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM audit_events WHERE actor_person_id IS NULL) THEN RAISE EXCEPTION 'Cannot downgrade: federated audit actors exist'; END IF; END $$;");
        migrationBuilder.DropCheckConstraint("CK_audit_events_actor_origin", "audit_events");
        migrationBuilder.DropColumn("actor_instance_id", "audit_events");
        migrationBuilder.DropColumn("actor_site_id", "audit_events");
        migrationBuilder.DropColumn("actor_site_name", "audit_events");
        migrationBuilder.AlterColumn<Guid>("actor_person_id", "audit_events", "uuid", nullable: false,
            oldClrType: typeof(Guid), oldType: "uuid", oldNullable: true);
    }
}
