using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddActivityLifecycleFoundation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<Guid>(
                name: "domain_event_id",
                table: "notification_outbox",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "notification_kind",
                table: "notification_outbox",
                type: "character varying(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "activity_metadata_json",
                table: "domain_events",
                type: "jsonb",
                nullable: false,
                defaultValue: "{}");

            migrationBuilder.AddColumn<string>(
                name: "activity_type",
                table: "domain_events",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "actor_instance_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "actor_kind",
                table: "domain_events",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "legacy-unknown");

            migrationBuilder.AddColumn<Guid>(
                name: "actor_machine_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "actor_site_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "actor_system",
                table: "domain_events",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "causation_event_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "context_work_item_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "correlation_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "effect_key",
                table: "domain_events",
                type: "character varying(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "operation_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "origin_instance_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "origin_site_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "recorded_at",
                table: "domain_events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "request_id",
                table: "domain_events",
                type: "character varying(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "domain_events",
                type: "character varying(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "legacy");

            migrationBuilder.AddColumn<Guid>(
                name: "source_message_id",
                table: "domain_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "correlation_id",
                table: "audit_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "domain_event_id",
                table: "audit_events",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "event_projections",
                columns: table => new
                {
                    consumer = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    domain_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    lease_owner = table.Column<Guid>(type: "uuid", nullable: true),
                    lease_expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_error = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_event_projections", x => new { x.consumer, x.domain_event_id });
                    table.CheckConstraint("CK_event_projections_state", "consumer IN ('notifications', 'webhooks') AND status IN ('pending', 'processing', 'completed', 'skipped') AND attempt_count >= 0 AND ((status = 'processing' AND lease_owner IS NOT NULL AND lease_expires_at IS NOT NULL) OR (status <> 'processing' AND lease_owner IS NULL AND lease_expires_at IS NULL))");
                    table.ForeignKey(
                        name: "FK_event_projections_domain_events_domain_event_id",
                        column: x => x.domain_event_id,
                        principalTable: "domain_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "information_lifecycle",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_site_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resource_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    resource_id = table.Column<Guid>(type: "uuid", nullable: false),
                    context_work_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                    stage = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    changed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    archived_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    policy_id = table.Column<Guid>(type: "uuid", nullable: true),
                    policy_version = table.Column<int>(type: "integer", nullable: true),
                    eligible_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    export_id = table.Column<Guid>(type: "uuid", nullable: true),
                    is_held = table.Column<bool>(type: "boolean", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_information_lifecycle", x => x.id);
                    table.CheckConstraint("CK_information_lifecycle_reversible", "stage IN ('active', 'closed', 'archived') AND version > 0 AND (owner_site_id IS NOT NULL OR context_work_item_id IS NULL)");
                    table.ForeignKey(
                        name: "FK_information_lifecycle_sites_owner_site_id",
                        column: x => x.owner_site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_information_lifecycle_work_items_context_work_item_id",
                        column: x => x.context_work_item_id,
                        principalTable: "work_items",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notification_outbox_domain_event_id_recipient_person_id_not~",
                table: "notification_outbox",
                columns: new[] { "domain_event_id", "recipient_person_id", "notification_kind" },
                unique: true,
                filter: "domain_event_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_domain_events_operation_id_site_id_resource_type_resource_i~",
                table: "domain_events",
                columns: new[] { "operation_id", "site_id", "resource_type", "resource_id", "activity_type", "effect_key" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_domain_events_site_id_context_work_item_id_occurred_at_id",
                table: "domain_events",
                columns: new[] { "site_id", "context_work_item_id", "occurred_at", "id" });

            migrationBuilder.CreateIndex(
                name: "IX_domain_events_site_id_resource_type_resource_id_occurred_at~",
                table: "domain_events",
                columns: new[] { "site_id", "resource_type", "resource_id", "occurred_at", "id" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_domain_events_activity_context",
                table: "domain_events",
                sql: "source = 'legacy' OR (recorded_at IS NOT NULL AND origin_instance_id IS NOT NULL AND origin_site_id IS NOT NULL AND operation_id IS NOT NULL AND activity_type IS NOT NULL AND effect_key IS NOT NULL AND ((source = 'local' AND actor_kind = 'person' AND actor_person_id IS NOT NULL AND actor_machine_id IS NULL AND actor_system IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL) OR (source = 'local' AND actor_kind = 'machine' AND actor_person_id IS NULL AND actor_machine_id IS NOT NULL AND actor_system IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL) OR (source = 'system' AND actor_kind = 'system' AND actor_system IS NOT NULL AND actor_person_id IS NULL AND actor_machine_id IS NULL AND actor_instance_id IS NULL AND actor_site_id IS NULL) OR (source = 'federated' AND actor_kind = 'federated-site' AND actor_instance_id IS NOT NULL AND actor_site_id IS NOT NULL AND actor_person_id IS NULL AND actor_machine_id IS NULL AND actor_system IS NULL)))");

            migrationBuilder.CreateIndex(
                name: "IX_event_projections_consumer_status_next_attempt_at",
                table: "event_projections",
                columns: new[] { "consumer", "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "IX_event_projections_domain_event_id",
                table: "event_projections",
                column: "domain_event_id");

            migrationBuilder.CreateIndex(
                name: "IX_information_lifecycle_context_work_item_id",
                table: "information_lifecycle",
                column: "context_work_item_id");

            migrationBuilder.CreateIndex(
                name: "IX_information_lifecycle_owner_site_id_resource_type_resource_~",
                table: "information_lifecycle",
                columns: new[] { "owner_site_id", "resource_type", "resource_id" },
                unique: true,
                filter: "owner_site_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_information_lifecycle_resource_type_resource_id",
                table: "information_lifecycle",
                columns: new[] { "resource_type", "resource_id" },
                unique: true,
                filter: "owner_site_id IS NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "event_projections");

            migrationBuilder.DropTable(
                name: "information_lifecycle");

            migrationBuilder.DropIndex(
                name: "IX_notification_outbox_domain_event_id_recipient_person_id_not~",
                table: "notification_outbox");

            migrationBuilder.DropIndex(
                name: "IX_domain_events_operation_id_site_id_resource_type_resource_i~",
                table: "domain_events");

            migrationBuilder.DropIndex(
                name: "IX_domain_events_site_id_context_work_item_id_occurred_at_id",
                table: "domain_events");

            migrationBuilder.DropIndex(
                name: "IX_domain_events_site_id_resource_type_resource_id_occurred_at~",
                table: "domain_events");

            migrationBuilder.DropCheckConstraint(
                name: "CK_domain_events_activity_context",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "domain_event_id",
                table: "notification_outbox");

            migrationBuilder.DropColumn(
                name: "notification_kind",
                table: "notification_outbox");

            migrationBuilder.DropColumn(
                name: "activity_metadata_json",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "activity_type",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "actor_instance_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "actor_kind",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "actor_machine_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "actor_site_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "actor_system",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "causation_event_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "context_work_item_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "correlation_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "effect_key",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "operation_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "origin_instance_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "origin_site_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "recorded_at",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "request_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "source",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "source_message_id",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "correlation_id",
                table: "audit_events");

            migrationBuilder.DropColumn(
                name: "domain_event_id",
                table: "audit_events");
        }
    }
}
