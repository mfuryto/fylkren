using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261008235500_AddPrimaryDocumentSnapshots")]
public partial class AddPrimaryDocumentSnapshots : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "primary_document_snapshots",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                site_id = table.Column<Guid>(type: "uuid", nullable: false),
                work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                version = table.Column<int>(type: "integer", nullable: false),
                name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                media_type = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                source_url = table.Column<string>(type: "character varying(2048)", maxLength: 2048, nullable: true),
                extracted_text = table.Column<string>(type: "character varying(100000)", maxLength: 100000, nullable: false),
                structured_content = table.Column<string>(type: "jsonb", nullable: false),
                available_to_ai = table.Column<bool>(type: "boolean", nullable: false),
                created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_primary_document_snapshots", x => x.id);
                table.CheckConstraint("CK_primary_document_snapshot_version", "version > 0");
                table.ForeignKey("FK_primary_document_snapshots_people_created_by_person_id", x => x.created_by_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_primary_document_snapshots_sites_site_id", x => x.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_primary_document_snapshots_work_items_work_item_id", x => x.work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
            });
        migrationBuilder.CreateIndex("IX_primary_document_snapshots_created_by_person_id", "primary_document_snapshots", "created_by_person_id");
        migrationBuilder.CreateIndex("IX_primary_document_snapshots_site_id_available_to_ai", "primary_document_snapshots", new[] { "site_id", "available_to_ai" });
        migrationBuilder.CreateIndex("IX_primary_document_snapshots_work_item_id_version", "primary_document_snapshots", new[] { "work_item_id", "version" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable(name: "primary_document_snapshots");
}
