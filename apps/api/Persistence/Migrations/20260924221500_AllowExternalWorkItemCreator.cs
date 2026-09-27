using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260924221500_AllowExternalWorkItemCreator")]
public partial class AllowExternalWorkItemCreator : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AlterColumn<Guid>(
            name: "created_by_person_id",
            table: "work_items",
            type: "uuid",
            nullable: true,
            oldClrType: typeof(Guid),
            oldType: "uuid");
        migrationBuilder.AddCheckConstraint(
            name: "CK_work_items_external_creator",
            table: "work_items",
            sql: "created_by_person_id IS NOT NULL OR NULLIF(BTRIM(sender_site_name), '') IS NOT NULL");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // A live installation may already contain externally originated work.
        // Refuse a destructive downgrade rather than discard its provenance.
        migrationBuilder.Sql("DO $$ BEGIN IF EXISTS (SELECT 1 FROM work_items WHERE created_by_person_id IS NULL) THEN RAISE EXCEPTION 'Cannot downgrade: externally originated work items exist'; END IF; END $$;");
        migrationBuilder.DropCheckConstraint(name: "CK_work_items_external_creator", table: "work_items");
        migrationBuilder.AlterColumn<Guid>(
            name: "created_by_person_id",
            table: "work_items",
            type: "uuid",
            nullable: false,
            oldClrType: typeof(Guid),
            oldType: "uuid",
            oldNullable: true);
    }
}
