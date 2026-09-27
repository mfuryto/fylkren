using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddDomainEventsAndWebhooks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "domain_events",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    event_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    schema_version = table.Column<int>(type: "integer", nullable: false),
                    occurred_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    actor_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    resource_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    resource_id = table.Column<Guid>(type: "uuid", nullable: false),
                    payload_json = table.Column<string>(type: "jsonb", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_domain_events", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "webhook_subscriptions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    endpoint_url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    protected_secret = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    event_types = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_webhook_subscriptions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "webhook_deliveries",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    subscription_id = table.Column<Guid>(type: "uuid", nullable: false),
                    domain_event_id = table.Column<Guid>(type: "uuid", nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_http_status = table.Column<int>(type: "integer", nullable: true),
                    last_error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_webhook_deliveries", x => x.id);
                    table.ForeignKey(
                        name: "FK_webhook_deliveries_domain_events_domain_event_id",
                        column: x => x.domain_event_id,
                        principalTable: "domain_events",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_webhook_deliveries_webhook_subscriptions_subscription_id",
                        column: x => x.subscription_id,
                        principalTable: "webhook_subscriptions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "webhook_delivery_attempts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    delivery_id = table.Column<Guid>(type: "uuid", nullable: false),
                    attempt_number = table.Column<int>(type: "integer", nullable: false),
                    attempted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    duration_ms = table.Column<long>(type: "bigint", nullable: false),
                    outcome = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    http_status = table.Column<int>(type: "integer", nullable: true),
                    error = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_webhook_delivery_attempts", x => x.id);
                    table.ForeignKey(
                        name: "FK_webhook_delivery_attempts_webhook_deliveries_delivery_id",
                        column: x => x.delivery_id,
                        principalTable: "webhook_deliveries",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_domain_events_event_type_occurred_at",
                table: "domain_events",
                columns: new[] { "event_type", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_domain_events_site_id_occurred_at",
                table: "domain_events",
                columns: new[] { "site_id", "occurred_at" });

            migrationBuilder.CreateIndex(
                name: "IX_webhook_deliveries_domain_event_id",
                table: "webhook_deliveries",
                column: "domain_event_id");

            migrationBuilder.CreateIndex(
                name: "IX_webhook_deliveries_status_next_attempt_at",
                table: "webhook_deliveries",
                columns: new[] { "status", "next_attempt_at" });

            migrationBuilder.CreateIndex(
                name: "IX_webhook_deliveries_subscription_id_domain_event_id",
                table: "webhook_deliveries",
                columns: new[] { "subscription_id", "domain_event_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_webhook_delivery_attempts_delivery_id_attempt_number",
                table: "webhook_delivery_attempts",
                columns: new[] { "delivery_id", "attempt_number" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_webhook_subscriptions_site_id_is_active",
                table: "webhook_subscriptions",
                columns: new[] { "site_id", "is_active" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "webhook_delivery_attempts");

            migrationBuilder.DropTable(
                name: "webhook_deliveries");

            migrationBuilder.DropTable(
                name: "domain_events");

            migrationBuilder.DropTable(
                name: "webhook_subscriptions");
        }
    }
}
