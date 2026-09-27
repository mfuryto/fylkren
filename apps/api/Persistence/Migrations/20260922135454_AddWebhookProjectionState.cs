using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWebhookProjectionState : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "webhooks_projected_at",
                table: "domain_events",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_domain_events_webhooks_projected_at",
                table: "domain_events",
                column: "webhooks_projected_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_domain_events_webhooks_projected_at",
                table: "domain_events");

            migrationBuilder.DropColumn(
                name: "webhooks_projected_at",
                table: "domain_events");
        }
    }
}
