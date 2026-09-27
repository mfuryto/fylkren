using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260922113000_AddWorkItemDependencies")]
public partial class AddWorkItemDependencies : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "work_item_dependencies",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                site_id = table.Column<Guid>(type: "uuid", nullable: false),
                predecessor_work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                dependent_work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
                type = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_work_item_dependencies", value => value.id);
                table.CheckConstraint("CK_work_item_dependencies_distinct_items", "predecessor_work_item_id <> dependent_work_item_id");
                table.ForeignKey("FK_work_item_dependencies_people_created_by_person_id", value => value.created_by_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_work_item_dependencies_sites_site_id", value => value.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_work_item_dependencies_work_items_dependent_work_item_id", value => value.dependent_work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_work_item_dependencies_work_items_predecessor_work_item_id", value => value.predecessor_work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("IX_work_item_dependencies_created_by_person_id", "work_item_dependencies", "created_by_person_id");
        migrationBuilder.CreateIndex("IX_work_item_dependencies_predecessor_work_item_id", "work_item_dependencies", "predecessor_work_item_id");
        migrationBuilder.CreateIndex("IX_work_item_dependencies_site_id_predecessor_work_item_id", "work_item_dependencies", new[] { "site_id", "predecessor_work_item_id" });
        migrationBuilder.CreateIndex("IX_work_item_dependencies_dependent_work_item_id_predecessor_work_item_id_type", "work_item_dependencies", new[] { "dependent_work_item_id", "predecessor_work_item_id", "type" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder) =>
        migrationBuilder.DropTable(name: "work_item_dependencies");
}
