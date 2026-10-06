using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261006223000_AddExternalIdentityProvisioning")]
public partial class AddExternalIdentityProvisioning : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTimeOffset>(name: "provisioned_at",
            table: "external_identity_links", type: "timestamp with time zone", nullable: true);
        migrationBuilder.CreateTable(name: "external_identity_provisioning_issues", columns: table => new
        {
            id = table.Column<Guid>(type: "uuid", nullable: false),
            provider = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
            provider_instance_id = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
            subject_id = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: false),
            username = table.Column<string>(type: "character varying(256)", maxLength: 256, nullable: true),
            display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
            email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
            reason = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
            first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            resolved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
        }, constraints: table => table.PrimaryKey("PK_external_identity_provisioning_issues", value => value.id));
        migrationBuilder.CreateIndex(name: "IX_external_identity_provisioning_issues_provider_provider_instance_id_subject_id",
            table: "external_identity_provisioning_issues", columns: new[] { "provider", "provider_instance_id", "subject_id" }, unique: true);
        migrationBuilder.CreateIndex(name: "IX_external_identity_provisioning_issues_resolved_at_last_seen_at",
            table: "external_identity_provisioning_issues", columns: new[] { "resolved_at", "last_seen_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "external_identity_provisioning_issues");
        migrationBuilder.DropColumn(name: "provisioned_at", table: "external_identity_links");
    }
}
