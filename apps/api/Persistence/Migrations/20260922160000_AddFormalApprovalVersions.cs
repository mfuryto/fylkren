using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260922160000_AddFormalApprovalVersions")]
public partial class AddFormalApprovalVersions : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "domain_object_versions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                site_id = table.Column<Guid>(type: "uuid", nullable: false),
                object_type = table.Column<string>(type: "character varying(60)", maxLength: 60, nullable: false),
                object_id = table.Column<Guid>(type: "uuid", nullable: false),
                context_work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                version_number = table.Column<int>(type: "integer", nullable: false),
                title = table.Column<string>(type: "character varying(240)", maxLength: 240, nullable: false),
                content_json = table.Column<string>(type: "jsonb", nullable: false),
                content_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                approval_status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_domain_object_versions", x => x.id);
                table.ForeignKey("FK_domain_object_versions_people_created_by_person_id", x => x.created_by_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_domain_object_versions_sites_site_id", x => x.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_domain_object_versions_work_items_context_work_item_id", x => x.context_work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "formal_approval_signoffs",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                version_id = table.Column<Guid>(type: "uuid", nullable: false),
                approver_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                approver_name_snapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                signed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                comment = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_formal_approval_signoffs", x => x.id);
                table.ForeignKey("FK_formal_approval_signoffs_domain_object_versions_version_id", x => x.version_id, "domain_object_versions", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_formal_approval_signoffs_people_approver_person_id", x => x.approver_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("IX_domain_object_versions_context_work_item_id", "domain_object_versions", "context_work_item_id");
        migrationBuilder.CreateIndex("IX_domain_object_versions_created_by_person_id", "domain_object_versions", "created_by_person_id");
        migrationBuilder.CreateIndex("IX_domain_object_versions_site_id_context_work_item_id_created_at", "domain_object_versions", new[] { "site_id", "context_work_item_id", "created_at" });
        migrationBuilder.CreateIndex("IX_domain_object_versions_site_id_object_type_object_id_version_number", "domain_object_versions", new[] { "site_id", "object_type", "object_id", "version_number" }, unique: true);
        migrationBuilder.CreateIndex("IX_formal_approval_signoffs_approver_person_id", "formal_approval_signoffs", "approver_person_id");
        migrationBuilder.CreateIndex("IX_formal_approval_signoffs_version_id_approver_person_id", "formal_approval_signoffs", new[] { "version_id", "approver_person_id" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "formal_approval_signoffs");
        migrationBuilder.DropTable(name: "domain_object_versions");
    }
}
