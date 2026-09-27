using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260924120000_AddFederationPeerCandidates")]
public partial class AddFederationPeerCandidates : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "federation_peers",
            columns: table => new
            {
                instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                base_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: false),
                pinned_public_key_spki = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: true),
                last_proof_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_federation_peers", x => x.instance_id));
        migrationBuilder.CreateIndex("IX_federation_peers_pinned_public_key_spki", "federation_peers", "pinned_public_key_spki", unique: true);

        migrationBuilder.CreateTable(
            name: "federation_probe_nonces",
            columns: table => new
            {
                peer_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                nonce = table.Column<Guid>(type: "uuid", nullable: false),
                received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_federation_probe_nonces", x => new { x.peer_instance_id, x.nonce });
                table.ForeignKey("FK_federation_probe_nonces_federation_peers_peer_instance_id", x => x.peer_instance_id,
                    "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_federation_probe_nonces_received_at", "federation_probe_nonces", "received_at");

        migrationBuilder.CreateTable(
            name: "federation_site_publications",
            columns: table => new
            {
                peer_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                local_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                revision = table.Column<long>(type: "bigint", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_federation_site_publications", x => new { x.peer_instance_id, x.local_site_id });
                table.ForeignKey("FK_federation_site_publications_federation_peers_peer_instance_id", x => x.peer_instance_id,
                    "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_federation_site_publications_sites_local_site_id", x => x.local_site_id,
                    "sites", "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_federation_site_publications_local_site_id", "federation_site_publications", "local_site_id");

        migrationBuilder.CreateTable(
            name: "federation_site_grants",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                peer_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                local_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                remote_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                direction = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false),
                revision = table.Column<long>(type: "bigint", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_federation_site_grants", x => x.id);
                table.CheckConstraint("CK_federation_site_grants_direction", "direction IN ('inbound', 'outbound')");
                table.ForeignKey("FK_federation_site_grants_federation_peers_peer_instance_id", x => x.peer_instance_id,
                    "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_federation_site_grants_sites_local_site_id", x => x.local_site_id,
                    "sites", "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_federation_site_grants_local_site_id_is_active", "federation_site_grants",
            new[] { "local_site_id", "is_active" });
        migrationBuilder.CreateIndex("IX_federation_site_grants_peer_instance_id_local_site_id_remote_site_id_direction",
            "federation_site_grants", new[] { "peer_instance_id", "local_site_id", "remote_site_id", "direction" }, unique: true);

        migrationBuilder.CreateTable(
            name: "federation_signing_identity",
            columns: table => new
            {
                key = table.Column<int>(type: "integer", nullable: false),
                public_key_spki = table.Column<string>(type: "character varying(512)", maxLength: 512, nullable: false),
                protected_private_key = table.Column<string>(type: "character varying(4096)", maxLength: 4096, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_federation_signing_identity", x => x.key));

        migrationBuilder.CreateTable(
            name: "federation_remote_sites",
            columns: table => new
            {
                instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                site_id = table.Column<Guid>(type: "uuid", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                catalog_revision = table.Column<long>(type: "bigint", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                is_active = table.Column<bool>(type: "boolean", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_federation_remote_sites", x => new { x.instance_id, x.site_id });
                table.ForeignKey("FK_federation_remote_sites_federation_peers_instance_id", x => x.instance_id,
                    "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "federation_work_links",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                local_work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                peer_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                remote_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                origin_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                origin_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                origin_resource_id = table.Column<Guid>(type: "uuid", nullable: false),
                direction = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                remote_work_item_id = table.Column<Guid>(type: "uuid", nullable: true),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                acknowledged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_federation_work_links", x => x.id);
                table.CheckConstraint("CK_federation_work_links_direction", "direction IN ('incoming', 'outgoing')");
                table.ForeignKey("FK_federation_work_links_federation_peers_peer_instance_id", x => x.peer_instance_id,
                    "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_federation_work_links_work_items_local_work_item_id", x => x.local_work_item_id,
                    "work_items", "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_federation_work_links_local_work_item_id", "federation_work_links", "local_work_item_id", unique: true);
        migrationBuilder.CreateIndex("IX_federation_work_links_peer_instance_id", "federation_work_links", "peer_instance_id");
        migrationBuilder.CreateIndex("IX_federation_work_links_origin_address",
            "federation_work_links", new[] { "origin_instance_id", "origin_site_id", "origin_resource_id", "peer_instance_id", "remote_site_id" }, unique: true);

        migrationBuilder.CreateTable(
            name: "federation_outbound_messages",
            columns: table => new
            {
                message_id = table.Column<Guid>(type: "uuid", nullable: false),
                peer_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                source_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                destination_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                origin_instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                origin_site_id = table.Column<Guid>(type: "uuid", nullable: false),
                origin_resource_id = table.Column<Guid>(type: "uuid", nullable: false),
                message_type = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                schema_version = table.Column<int>(type: "integer", nullable: false),
                payload_json = table.Column<string>(type: "character varying(1000000)", maxLength: 1_000_000, nullable: false),
                correlation_id = table.Column<Guid>(type: "uuid", nullable: true),
                causation_id = table.Column<Guid>(type: "uuid", nullable: true),
                status = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                attempt_count = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                next_attempt_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                delivered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                last_error_code = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_federation_outbound_messages", x => x.message_id);
                table.CheckConstraint("CK_federation_outbound_messages_status", "status IN ('pending', 'retrying', 'delivered', 'failed')");
                table.ForeignKey("FK_federation_outbound_messages_federation_peers_peer_instance_id", x => x.peer_instance_id,
                    "federation_peers", "instance_id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_federation_outbound_messages_sites_source_site_id", x => x.source_site_id,
                    "sites", "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_federation_outbound_messages_peer_instance_id_created_at",
            "federation_outbound_messages", new[] { "peer_instance_id", "created_at" });
        migrationBuilder.CreateIndex("IX_federation_outbound_messages_source_site_id", "federation_outbound_messages", "source_site_id");
        migrationBuilder.CreateIndex("IX_federation_outbound_messages_status_next_attempt_at",
            "federation_outbound_messages", new[] { "status", "next_attempt_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("federation_outbound_messages");
        migrationBuilder.DropTable("federation_probe_nonces");
        migrationBuilder.DropTable("federation_site_publications");
        migrationBuilder.DropTable("federation_site_grants");
        migrationBuilder.DropTable("federation_work_links");
        migrationBuilder.DropTable("federation_remote_sites");
        migrationBuilder.DropTable("federation_signing_identity");
        migrationBuilder.DropTable("federation_peers");
    }
}
