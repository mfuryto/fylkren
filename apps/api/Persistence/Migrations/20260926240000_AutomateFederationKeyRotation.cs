using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260926240000_AutomateFederationKeyRotation")]
public partial class AutomateFederationKeyRotation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.RenameColumn("previous_pinned_public_key_spki", "federation_peers",
            "pending_pinned_public_key_spki");
        migrationBuilder.AddColumn<Guid>("last_completed_key_rotation_id", "federation_peers",
            type: "uuid", nullable: true);
        migrationBuilder.AddColumn<Guid>("active_rotation_id", "federation_signing_identity",
            type: "uuid", nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>("rotation_activated_at", "federation_signing_identity",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.DropCheckConstraint("CK_audit_events_actor_origin", "audit_events");
        migrationBuilder.AddCheckConstraint("CK_audit_events_actor_origin", "audit_events",
            "(actor_person_id IS NOT NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND NULLIF(BTRIM(actor_site_name), '') IS NOT NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NULL AND actor_site_name IS NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint("CK_audit_events_actor_origin", "audit_events");
        migrationBuilder.AddCheckConstraint("CK_audit_events_actor_origin", "audit_events",
            "(actor_person_id IS NOT NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL) OR " +
            "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND NULLIF(BTRIM(actor_site_name), '') IS NOT NULL)");
        migrationBuilder.DropColumn("last_completed_key_rotation_id", "federation_peers");
        migrationBuilder.DropColumn("active_rotation_id", "federation_signing_identity");
        migrationBuilder.DropColumn("rotation_activated_at", "federation_signing_identity");
        migrationBuilder.RenameColumn("pending_pinned_public_key_spki", "federation_peers",
            "previous_pinned_public_key_spki");
    }
}
