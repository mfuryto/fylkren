using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260927220000_AddDirectoryLifecycleDeprovisioning")]
public sealed class AddDirectoryLifecycleDeprovisioning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<bool>(
            name: "directory_access_enabled", table: "external_identity_links",
            type: "boolean", nullable: false, defaultValue: true);
        migrationBuilder.AddColumn<string>(
            name: "directory_lifecycle_status", table: "external_identity_links",
            type: "character varying(30)", maxLength: 30, nullable: false,
            defaultValue: "pending");
        migrationBuilder.AddColumn<int>(
            name: "directory_missing_count", table: "external_identity_links",
            type: "integer", nullable: false, defaultValue: 0);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "directory_last_checked_at", table: "external_identity_links",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "directory_last_successful_sync_at", table: "external_identity_links",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(
            name: "directory_suspended_at", table: "external_identity_links",
            type: "timestamp with time zone", nullable: true);

        migrationBuilder.DropCheckConstraint(
            name: "CK_audit_events_actor_origin", table: "audit_events");
        migrationBuilder.AddColumn<string>(
            name: "actor_system", table: "audit_events",
            type: "character varying(100)", maxLength: 100, nullable: true);
        migrationBuilder.AddCheckConstraint(
            name: "CK_audit_events_actor_origin", table: "audit_events",
            sql: "(actor_person_id IS NOT NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL AND actor_system IS NULL) OR " +
                 "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND NULLIF(BTRIM(actor_site_name), '') IS NOT NULL AND actor_system IS NULL) OR " +
                 "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NULL AND actor_site_name IS NULL AND actor_system IS NULL) OR " +
                 "(actor_person_id IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL AND NULLIF(BTRIM(actor_system), '') IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM audit_events WHERE actor_system IS NOT NULL) THEN RAISE EXCEPTION 'Cannot downgrade: system audit actors exist'; END IF; END $$;");
        migrationBuilder.DropCheckConstraint(
            name: "CK_audit_events_actor_origin", table: "audit_events");
        migrationBuilder.DropColumn(name: "actor_system", table: "audit_events");
        migrationBuilder.AddCheckConstraint(
            name: "CK_audit_events_actor_origin", table: "audit_events",
            sql: "(actor_person_id IS NOT NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL AND actor_site_name IS NULL) OR " +
                 "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND NULLIF(BTRIM(actor_site_name), '') IS NOT NULL) OR " +
                 "(actor_person_id IS NULL AND actor_instance_id IS NOT NULL AND actor_site_id IS NULL AND actor_site_name IS NULL)");

        migrationBuilder.DropColumn(name: "directory_access_enabled", table: "external_identity_links");
        migrationBuilder.DropColumn(name: "directory_lifecycle_status", table: "external_identity_links");
        migrationBuilder.DropColumn(name: "directory_missing_count", table: "external_identity_links");
        migrationBuilder.DropColumn(name: "directory_last_checked_at", table: "external_identity_links");
        migrationBuilder.DropColumn(name: "directory_last_successful_sync_at", table: "external_identity_links");
        migrationBuilder.DropColumn(name: "directory_suspended_at", table: "external_identity_links");
    }
}
