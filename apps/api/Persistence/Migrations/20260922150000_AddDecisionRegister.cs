using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260922150000_AddDecisionRegister")]
public partial class AddDecisionRegister : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "decisions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                site_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_decisions", value => value.id);
                table.ForeignKey("FK_decisions_people_created_by_person_id", value => value.created_by_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_decisions_sites_site_id", value => value.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "decision_revisions",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                decision_id = table.Column<Guid>(type: "uuid", nullable: false),
                revision_number = table.Column<int>(type: "integer", nullable: false),
                title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                decision_text = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                rationale = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                decided_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                recorded_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_decision_revisions", value => value.id);
                table.ForeignKey("FK_decision_revisions_decisions_decision_id", value => value.decision_id, "decisions", "id", onDelete: ReferentialAction.Restrict);
                table.ForeignKey("FK_decision_revisions_people_recorded_by_person_id", value => value.recorded_by_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "decision_makers",
            columns: table => new
            {
                revision_id = table.Column<Guid>(type: "uuid", nullable: false),
                person_id = table.Column<Guid>(type: "uuid", nullable: false),
                display_name_snapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_decision_makers", value => new { value.revision_id, value.person_id });
                table.ForeignKey("FK_decision_makers_decision_revisions_revision_id", value => value.revision_id, "decision_revisions", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateTable(
            name: "decision_references",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                revision_id = table.Column<Guid>(type: "uuid", nullable: false),
                object_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                object_id = table.Column<Guid>(type: "uuid", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_decision_references", value => value.id);
                table.ForeignKey("FK_decision_references_decision_revisions_revision_id", value => value.revision_id, "decision_revisions", "id", onDelete: ReferentialAction.Restrict);
            });

        migrationBuilder.CreateIndex("IX_decisions_created_by_person_id", "decisions", "created_by_person_id");
        migrationBuilder.CreateIndex("IX_decisions_site_id_created_at", "decisions", new[] { "site_id", "created_at" });
        migrationBuilder.CreateIndex("IX_decision_revisions_recorded_by_person_id", "decision_revisions", "recorded_by_person_id");
        migrationBuilder.CreateIndex("IX_decision_revisions_decision_id_revision_number", "decision_revisions", new[] { "decision_id", "revision_number" }, unique: true);
        migrationBuilder.CreateIndex("IX_decision_references_object_type_object_id", "decision_references", new[] { "object_type", "object_id" });
        migrationBuilder.CreateIndex("IX_decision_references_revision_id_object_type_object_id", "decision_references", new[] { "revision_id", "object_type", "object_id" }, unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "decision_makers");
        migrationBuilder.DropTable(name: "decision_references");
        migrationBuilder.DropTable(name: "decision_revisions");
        migrationBuilder.DropTable(name: "decisions");
    }
}
