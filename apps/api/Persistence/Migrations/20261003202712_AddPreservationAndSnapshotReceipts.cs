using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPreservationAndSnapshotReceipts : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "lifecycle_holds",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<string>(
                name: "source",
                table: "lifecycle_holds",
                type: "character varying(30)",
                maxLength: 30,
                nullable: false,
                defaultValue: "local");

            migrationBuilder.AddColumn<string>(
                name: "change_reason",
                table: "audit_events",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "export_receipts",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    snapshot_boundary = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    package_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    package_bytes = table.Column<long>(type: "bigint", nullable: false),
                    root_lifecycle_version = table.Column<long>(type: "bigint", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    acknowledged_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    acknowledged_by_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    acknowledgement_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_export_receipts", x => x.id);
                    table.ForeignKey(
                        name: "FK_export_receipts_people_acknowledged_by_person_id",
                        column: x => x.acknowledged_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_export_receipts_people_created_by_person_id",
                        column: x => x.created_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_export_receipts_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.AddCheckConstraint(
                name: "CK_lifecycle_hold_source",
                table: "lifecycle_holds",
                sql: "(source = 'local' AND created_by_person_id IS NOT NULL) OR (source = 'legacy' AND created_by_person_id IS NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_export_receipts_acknowledged_by_person_id",
                table: "export_receipts",
                column: "acknowledged_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_export_receipts_created_by_person_id",
                table: "export_receipts",
                column: "created_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_export_receipts_site_id_created_at",
                table: "export_receipts",
                columns: new[] { "site_id", "created_at" });
            migrationBuilder.Sql("""
INSERT INTO lifecycle_holds(id,lifecycle_id,created_by_person_id,reason,created_at,source)
SELECT gen_random_uuid(),l.id,NULL,COALESCE(NULLIF(l.reason,''),'Legacy preservation hold: reason unavailable.'),now(),'legacy'
FROM information_lifecycle l WHERE l.is_held AND NOT EXISTS (SELECT 1 FROM lifecycle_holds h WHERE h.lifecycle_id=l.id AND h.released_at IS NULL);
CREATE FUNCTION fylkren_preserved_work(work_id uuid) RETURNS boolean LANGUAGE SQL STABLE AS $$
 WITH RECURSIVE chain AS (
   SELECT id,parent_work_item_id,site_id FROM work_items WHERE id=work_id
   UNION SELECT p.id,p.parent_work_item_id,p.site_id FROM work_items p JOIN chain c ON p.id=c.parent_work_item_id AND p.site_id=c.site_id)
 SELECT EXISTS(SELECT 1 FROM information_lifecycle l WHERE (l.is_held OR l.stage <> 'active') AND
   (l.resource_type='work_item' AND l.resource_id IN (SELECT id FROM chain)
    OR l.resource_type='site' AND l.resource_id IN (SELECT site_id FROM chain) AND l.owner_site_id=l.resource_id));
$$;
""");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM export_receipts) OR EXISTS (SELECT 1 FROM audit_events WHERE change_reason IS NOT NULL) OR EXISTS (SELECT 1 FROM domain_events WHERE source <> 'legacy' AND context_work_item_id IS NOT NULL) OR EXISTS (SELECT 1 FROM archive_grants) OR EXISTS (SELECT 1 FROM lifecycle_holds) OR EXISTS (SELECT 1 FROM retention_policy_versions) THEN RAISE EXCEPTION 'Preservation cutover requires a forward fix.' USING ERRCODE = '23514', CONSTRAINT = 'activity_cutover_forward_fix_required'; END IF; END $$; DROP FUNCTION fylkren_preserved_work(uuid);");
            migrationBuilder.DropTable(
                name: "export_receipts");

            migrationBuilder.DropCheckConstraint(
                name: "CK_lifecycle_hold_source",
                table: "lifecycle_holds");

            migrationBuilder.DropColumn(
                name: "source",
                table: "lifecycle_holds");

            migrationBuilder.DropColumn(
                name: "change_reason",
                table: "audit_events");

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "lifecycle_holds",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
