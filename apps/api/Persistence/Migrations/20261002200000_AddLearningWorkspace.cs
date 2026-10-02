using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261002200000_AddLearningWorkspace")]
public sealed class AddLearningWorkspace : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("learning_lessons", table => new
        {
            id = table.Column<Guid>(type: "uuid", nullable: false),
            site_id = table.Column<Guid>(type: "uuid", nullable: false),
            work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
            unit_id = table.Column<Guid>(type: "uuid", nullable: false),
            number = table.Column<int>(type: "integer", nullable: false),
            kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
            text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
            author_person_id = table.Column<Guid>(type: "uuid", nullable: false),
            author_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
            status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
            priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
            action_plan = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
            treatment_note = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
            due_on = table.Column<DateOnly>(type: "date", nullable: true),
            owner_person_id = table.Column<Guid>(type: "uuid", nullable: true),
            owner_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
            created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
            version = table.Column<long>(type: "bigint", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_learning_lessons", value => value.id);
            table.ForeignKey("FK_learning_lessons_sites_site_id", value => value.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_learning_lessons_work_items_work_item_id", value => value.work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_learning_lessons_organization_units_unit_id", value => value.unit_id, "organization_units", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_learning_lessons_people_author_person_id", value => value.author_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_learning_lessons_people_owner_person_id", value => value.owner_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
        });
        migrationBuilder.CreateIndex("IX_learning_lessons_work_item_id_number", "learning_lessons", new[] { "work_item_id", "number" }, unique: true);
        migrationBuilder.CreateIndex("IX_learning_lessons_unit_id_status_priority", "learning_lessons", new[] { "unit_id", "status", "priority" });
        migrationBuilder.CreateIndex("IX_learning_lessons_site_id", "learning_lessons", "site_id");
        migrationBuilder.CreateIndex("IX_learning_lessons_author_person_id", "learning_lessons", "author_person_id");
        migrationBuilder.CreateIndex("IX_learning_lessons_owner_person_id", "learning_lessons", "owner_person_id");
        migrationBuilder.CreateTable("learning_entries", table => new
        {
            id = table.Column<Guid>(type: "uuid", nullable: false),
            site_id = table.Column<Guid>(type: "uuid", nullable: false),
            lesson_id = table.Column<Guid>(type: "uuid", nullable: false),
            author_person_id = table.Column<Guid>(type: "uuid", nullable: false),
            author_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
            kind = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
            text = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
            status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
            priority = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
            action_plan = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
            due_on = table.Column<DateOnly>(type: "date", nullable: true),
            created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_learning_entries", value => value.id);
            table.ForeignKey("FK_learning_entries_sites_site_id", value => value.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_learning_entries_learning_lessons_lesson_id", value => value.lesson_id, "learning_lessons", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_learning_entries_people_author_person_id", value => value.author_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
        });
        migrationBuilder.CreateIndex("IX_learning_entries_lesson_id_created_at_id", "learning_entries", new[] { "lesson_id", "created_at", "id" });
        migrationBuilder.CreateIndex("IX_learning_entries_site_id", "learning_entries", "site_id");
        migrationBuilder.CreateIndex("IX_learning_entries_author_person_id", "learning_entries", "author_person_id");
    }
    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable("learning_entries");
        migrationBuilder.DropTable("learning_lessons");
    }
}
