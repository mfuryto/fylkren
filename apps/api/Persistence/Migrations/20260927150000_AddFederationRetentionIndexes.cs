using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260927150000_AddFederationRetentionIndexes")]
public partial class AddFederationRetentionIndexes : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateIndex(
            name: "IX_federation_inbound_receipts_received_at",
            table: "federation_inbound_receipts",
            column: "received_at");
        migrationBuilder.CreateIndex(
            name: "IX_federation_outbound_messages_peer_instance_id_status",
            table: "federation_outbound_messages",
            columns: new[] { "peer_instance_id", "status" });
        migrationBuilder.CreateIndex(
            name: "IX_federation_outbound_messages_status_delivered_at",
            table: "federation_outbound_messages",
            columns: new[] { "status", "delivered_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_federation_inbound_receipts_received_at",
            table: "federation_inbound_receipts");
        migrationBuilder.DropIndex(
            name: "IX_federation_outbound_messages_peer_instance_id_status",
            table: "federation_outbound_messages");
        migrationBuilder.DropIndex(
            name: "IX_federation_outbound_messages_status_delivered_at",
            table: "federation_outbound_messages");
    }
}
