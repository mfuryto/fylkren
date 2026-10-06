using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261006213000_VersionFederationSignatures")]
public partial class VersionFederationSignatures : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<int>(name: "negotiated_protocol_version", table: "federation_peers",
            type: "integer", nullable: false, defaultValue: 1);
        migrationBuilder.AddColumn<string>(name: "signature_algorithm", table: "federation_peers",
            type: "character varying(80)", maxLength: 80, nullable: true);
        migrationBuilder.AddCheckConstraint(name: "CK_federation_peers_signature_protocol",
            table: "federation_peers",
            sql: "(negotiated_protocol_version = 1 AND signature_algorithm IS NULL) OR " +
                 "(negotiated_protocol_version = 2 AND signature_algorithm = 'ecdsa-p256-sha256-p1363')");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "CK_federation_peers_signature_protocol",
            table: "federation_peers");
        migrationBuilder.DropColumn(name: "negotiated_protocol_version", table: "federation_peers");
        migrationBuilder.DropColumn(name: "signature_algorithm", table: "federation_peers");
    }
}
