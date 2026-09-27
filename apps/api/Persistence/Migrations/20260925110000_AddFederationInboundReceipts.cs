using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260925110000_AddFederationInboundReceipts")]
public partial class AddFederationInboundReceipts : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("federation_inbound_receipts", columns: table => new
        {
            peer_instance_id = table.Column<Guid>("uuid", nullable: false),
            message_id = table.Column<Guid>("uuid", nullable: false),
            message_type = table.Column<string>("character varying(80)", maxLength: 80, nullable: false),
            source_site_id = table.Column<Guid>("uuid", nullable: false),
            destination_site_id = table.Column<Guid>("uuid", nullable: false),
            origin_instance_id = table.Column<Guid>("uuid", nullable: false),
            origin_site_id = table.Column<Guid>("uuid", nullable: false),
            origin_resource_id = table.Column<Guid>("uuid", nullable: false),
            correlation_id = table.Column<Guid>("uuid", nullable: true),
            causation_id = table.Column<Guid>("uuid", nullable: true),
            payload_sha256 = table.Column<string>("character varying(64)", maxLength: 64, nullable: false),
            local_work_item_id = table.Column<Guid>("uuid", nullable: false),
            received_at = table.Column<DateTimeOffset>("timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_federation_inbound_receipts", value => new { value.peer_instance_id, value.message_id });
            table.ForeignKey("FK_federation_inbound_receipts_federation_peers_peer_instance_id",
                value => value.peer_instance_id, "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_federation_inbound_receipts_work_items_local_work_item_id",
                value => value.local_work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
        });
        migrationBuilder.CreateIndex("IX_federation_inbound_receipts_local_work_item_id",
            "federation_inbound_receipts", "local_work_item_id");
        migrationBuilder.CreateIndex("IX_federation_inbound_receipts_destination_site_id_received_at",
            "federation_inbound_receipts", new[] { "destination_site_id", "received_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable("federation_inbound_receipts");
}
