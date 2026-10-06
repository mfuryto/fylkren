using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261006220000_AddSignedMachineAuthentication")]
public partial class AddSignedMachineAuthentication : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "authentication_mode", table: "api_machine_identities",
            type: "character varying(20)", maxLength: 20, nullable: false, defaultValue: "bearer-v1");
        migrationBuilder.AddColumn<byte[]>(name: "public_key", table: "api_machine_identities",
            type: "bytea", nullable: true);
        migrationBuilder.AddColumn<string>(name: "signature_algorithm", table: "api_machine_identities",
            type: "character varying(60)", maxLength: 60, nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>(name: "legacy_bearer_accepted_until", table: "api_machine_identities",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.Sql("UPDATE api_machine_identities SET legacy_bearer_accepted_until = LEAST(COALESCE(expires_at, TIMESTAMPTZ '2027-01-04 23:59:59+00'), TIMESTAMPTZ '2027-01-04 23:59:59+00')");
        migrationBuilder.AddCheckConstraint(name: "ck_api_machine_authentication_mode",
            table: "api_machine_identities",
            sql: "(authentication_mode = 'bearer-v1' AND octet_length(secret_hash) > 0 AND public_key IS NULL AND signature_algorithm IS NULL AND legacy_bearer_accepted_until IS NOT NULL) OR " +
                 "(authentication_mode = 'signed-v2' AND octet_length(public_key) > 0 AND signature_algorithm = 'ecdsa-p256-sha256-p1363' AND legacy_bearer_accepted_until IS NULL)");
        migrationBuilder.CreateTable(name: "api_machine_request_nonces", columns: table => new
        {
            machine_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
            nonce = table.Column<string>(type: "character varying(96)", maxLength: 96, nullable: false),
            created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
        }, constraints: table =>
        {
            table.PrimaryKey("PK_api_machine_request_nonces", value => new { value.machine_identity_id, value.nonce });
            table.ForeignKey("FK_api_machine_request_nonces_api_machine_identities_machine_id", value => value.machine_identity_id,
                "api_machine_identities", "id", onDelete: ReferentialAction.Cascade);
        });
        migrationBuilder.CreateIndex(name: "IX_api_machine_request_nonces_expires_at",
            table: "api_machine_request_nonces", column: "expires_at");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "api_machine_request_nonces");
        migrationBuilder.DropCheckConstraint(name: "ck_api_machine_authentication_mode", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "authentication_mode", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "public_key", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "signature_algorithm", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "legacy_bearer_accepted_until", table: "api_machine_identities");
    }
}
