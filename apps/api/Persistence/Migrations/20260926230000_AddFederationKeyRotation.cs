using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260926230000_AddFederationKeyRotation")]
public partial class AddFederationKeyRotation : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("previous_pinned_public_key_spki", "federation_peers",
            type: "character varying(512)", maxLength: 512, nullable: true);
        migrationBuilder.AddColumn<Guid>("pending_key_rotation_id", "federation_peers",
            type: "uuid", nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>("key_rotation_staged_at", "federation_peers",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.AddColumn<Guid>("pending_rotation_id", "federation_signing_identity",
            type: "uuid", nullable: true);
        migrationBuilder.AddColumn<string>("pending_public_key_spki", "federation_signing_identity",
            type: "character varying(512)", maxLength: 512, nullable: true);
        migrationBuilder.AddColumn<string>("pending_protected_private_key", "federation_signing_identity",
            type: "character varying(4096)", maxLength: 4096, nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>("pending_created_at", "federation_signing_identity",
            type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("previous_pinned_public_key_spki", "federation_peers");
        migrationBuilder.DropColumn("pending_key_rotation_id", "federation_peers");
        migrationBuilder.DropColumn("key_rotation_staged_at", "federation_peers");
        migrationBuilder.DropColumn("pending_rotation_id", "federation_signing_identity");
        migrationBuilder.DropColumn("pending_public_key_spki", "federation_signing_identity");
        migrationBuilder.DropColumn("pending_protected_private_key", "federation_signing_identity");
        migrationBuilder.DropColumn("pending_created_at", "federation_signing_identity");
    }
}
