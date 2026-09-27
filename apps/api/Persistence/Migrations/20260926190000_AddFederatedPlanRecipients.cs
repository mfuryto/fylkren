using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260926190000_AddFederatedPlanRecipients")]
public partial class AddFederatedPlanRecipients : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_workflow_plan_requests_run_id_step_id_target_site_id",
            table: "workflow_plan_requests");

        migrationBuilder.AlterColumn<Guid>(
            name: "target_site_id",
            table: "workflow_plan_requests",
            type: "uuid",
            nullable: true,
            oldClrType: typeof(Guid),
            oldType: "uuid");

        migrationBuilder.AddColumn<Guid>(
            name: "target_instance_id",
            table: "workflow_plan_requests",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<Guid>(
            name: "remote_site_id",
            table: "workflow_plan_requests",
            type: "uuid",
            nullable: true);

        migrationBuilder.AddColumn<string>(
            name: "target_site_name_snapshot",
            table: "workflow_plan_requests",
            type: "character varying(200)",
            maxLength: 200,
            nullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_workflow_plan_requests_run_id_step_id_target_site_id",
            table: "workflow_plan_requests",
            columns: new[] { "run_id", "step_id", "target_site_id" },
            unique: true,
            filter: "target_site_id IS NOT NULL");

        migrationBuilder.CreateIndex(
            name: "IX_workflow_plan_requests_run_id_step_id_target_instance_id_remote_site_id",
            table: "workflow_plan_requests",
            columns: new[] { "run_id", "step_id", "target_instance_id", "remote_site_id" },
            unique: true,
            filter: "target_instance_id IS NOT NULL AND remote_site_id IS NOT NULL");

        migrationBuilder.AddCheckConstraint(
            name: "CK_workflow_plan_requests_recipient",
            table: "workflow_plan_requests",
            sql: "(target_site_id IS NOT NULL AND target_instance_id IS NULL AND remote_site_id IS NULL AND target_site_name_snapshot IS NULL) OR (target_site_id IS NULL AND target_instance_id IS NOT NULL AND remote_site_id IS NOT NULL AND NULLIF(BTRIM(target_site_name_snapshot), '') IS NOT NULL)");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(
            name: "CK_workflow_plan_requests_recipient",
            table: "workflow_plan_requests");

        migrationBuilder.DropIndex(
            name: "IX_workflow_plan_requests_run_id_step_id_target_instance_id_remote_site_id",
            table: "workflow_plan_requests");

        migrationBuilder.DropIndex(
            name: "IX_workflow_plan_requests_run_id_step_id_target_site_id",
            table: "workflow_plan_requests");

        migrationBuilder.DropColumn(name: "target_instance_id", table: "workflow_plan_requests");
        migrationBuilder.DropColumn(name: "remote_site_id", table: "workflow_plan_requests");
        migrationBuilder.DropColumn(name: "target_site_name_snapshot", table: "workflow_plan_requests");

        migrationBuilder.AlterColumn<Guid>(
            name: "target_site_id",
            table: "workflow_plan_requests",
            type: "uuid",
            nullable: false,
            defaultValue: Guid.Empty,
            oldClrType: typeof(Guid),
            oldType: "uuid",
            oldNullable: true);

        migrationBuilder.CreateIndex(
            name: "IX_workflow_plan_requests_run_id_step_id_target_site_id",
            table: "workflow_plan_requests",
            columns: new[] { "run_id", "step_id", "target_site_id" },
            unique: true);
    }
}
