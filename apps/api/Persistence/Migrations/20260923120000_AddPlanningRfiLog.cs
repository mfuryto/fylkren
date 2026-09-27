using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260923120000_AddPlanningRfiLog")]
public partial class AddPlanningRfiLog : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "planning_rfi_entries",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                run_id = table.Column<Guid>(type: "uuid", nullable: false),
                who = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                what = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                due_on = table.Column<DateOnly>(type: "date", nullable: true),
                answered = table.Column<bool>(type: "boolean", nullable: false),
                answer = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_planning_rfi_entries", x => x.id);
                table.ForeignKey("FK_planning_rfi_entries_workflow_runs_run_id", x => x.run_id, "workflow_runs", "id", onDelete: ReferentialAction.Cascade);
            });
        migrationBuilder.CreateIndex("IX_planning_rfi_entries_run_id_created_at", "planning_rfi_entries", new[] { "run_id", "created_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("planning_rfi_entries");
}
