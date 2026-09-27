using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddQueryPerformanceIndexes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_workflow_definitions_site_id",
                table: "workflow_definitions");

            migrationBuilder.DropIndex(
                name: "IX_role_assignments_person_id",
                table: "role_assignments");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_site_id_kind_is_active_owner_unit_id",
                table: "workflow_definitions",
                columns: new[] { "site_id", "kind", "is_active", "owner_unit_id" });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_site_id_status_created_at",
                table: "work_items",
                columns: new[] { "site_id", "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "IX_role_assignments_person_id_is_active_valid_from_valid_to",
                table: "role_assignments",
                columns: new[] { "person_id", "is_active", "valid_from", "valid_to" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_outbox_created_at_id",
                table: "notification_outbox",
                columns: new[] { "created_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_notification_outbox_status_created_at_id",
                table: "notification_outbox",
                columns: new[] { "status", "created_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_audit_events_occurred_at_id",
                table: "audit_events",
                columns: new[] { "occurred_at", "id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_workflow_definitions_site_id_kind_is_active_owner_unit_id",
                table: "workflow_definitions");

            migrationBuilder.DropIndex(
                name: "IX_work_items_site_id_status_created_at",
                table: "work_items");

            migrationBuilder.DropIndex(
                name: "IX_role_assignments_person_id_is_active_valid_from_valid_to",
                table: "role_assignments");

            migrationBuilder.DropIndex(
                name: "IX_notification_outbox_created_at_id",
                table: "notification_outbox");

            migrationBuilder.DropIndex(
                name: "IX_notification_outbox_status_created_at_id",
                table: "notification_outbox");

            migrationBuilder.DropIndex(
                name: "IX_audit_events_occurred_at_id",
                table: "audit_events");

            migrationBuilder.CreateIndex(
                name: "IX_workflow_definitions_site_id",
                table: "workflow_definitions",
                column: "site_id");

            migrationBuilder.CreateIndex(
                name: "IX_role_assignments_person_id",
                table: "role_assignments",
                column: "person_id");
        }
    }
}
