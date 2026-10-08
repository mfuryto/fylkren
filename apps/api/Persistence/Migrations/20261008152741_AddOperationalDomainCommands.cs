using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOperationalDomainCommands : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "risks",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_machine_id",
                table: "risks",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "recorded_by_person_id",
                table: "risk_revisions",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "recorded_by_machine_id",
                table: "risk_revisions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "risk_mitigations",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_machine_id",
                table: "risk_mitigations",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "recorded_by_person_id",
                table: "risk_mitigation_revisions",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "recorded_by_machine_id",
                table: "risk_mitigation_revisions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "decisions",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_machine_id",
                table: "decisions",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "recorded_by_person_id",
                table: "decision_revisions",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "recorded_by_machine_id",
                table: "decision_revisions",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_risks_created_by_machine_id",
                table: "risks",
                column: "created_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_risks_actor",
                table: "risks",
                sql: "(created_by_person_id IS NOT NULL) <> (created_by_machine_id IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_risk_revisions_recorded_by_machine_id",
                table: "risk_revisions",
                column: "recorded_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_risk_revisions_actor",
                table: "risk_revisions",
                sql: "(recorded_by_person_id IS NOT NULL) <> (recorded_by_machine_id IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_risk_mitigations_created_by_machine_id",
                table: "risk_mitigations",
                column: "created_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_risk_mitigations_actor",
                table: "risk_mitigations",
                sql: "(created_by_person_id IS NOT NULL) <> (created_by_machine_id IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_risk_mitigation_revisions_recorded_by_machine_id",
                table: "risk_mitigation_revisions",
                column: "recorded_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_risk_mitigation_revisions_actor",
                table: "risk_mitigation_revisions",
                sql: "(recorded_by_person_id IS NOT NULL) <> (recorded_by_machine_id IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_decisions_created_by_machine_id",
                table: "decisions",
                column: "created_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_decisions_actor",
                table: "decisions",
                sql: "(created_by_person_id IS NOT NULL) <> (created_by_machine_id IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_decision_revisions_recorded_by_machine_id",
                table: "decision_revisions",
                column: "recorded_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_decision_revisions_actor",
                table: "decision_revisions",
                sql: "(recorded_by_person_id IS NOT NULL) <> (recorded_by_machine_id IS NOT NULL)");

            migrationBuilder.AddForeignKey(
                name: "FK_decision_revisions_api_machine_identities_recorded_by_machi~",
                table: "decision_revisions",
                column: "recorded_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_decisions_api_machine_identities_created_by_machine_id",
                table: "decisions",
                column: "created_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_risk_mitigation_revisions_api_machine_identities_recorded_b~",
                table: "risk_mitigation_revisions",
                column: "recorded_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_risk_mitigations_api_machine_identities_created_by_machine_~",
                table: "risk_mitigations",
                column: "created_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_risk_revisions_api_machine_identities_recorded_by_machine_id",
                table: "risk_revisions",
                column: "recorded_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_risks_api_machine_identities_created_by_machine_id",
                table: "risks",
                column: "created_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_decision_revisions_api_machine_identities_recorded_by_machi~",
                table: "decision_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_decisions_api_machine_identities_created_by_machine_id",
                table: "decisions");

            migrationBuilder.DropForeignKey(
                name: "FK_risk_mitigation_revisions_api_machine_identities_recorded_b~",
                table: "risk_mitigation_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_risk_mitigations_api_machine_identities_created_by_machine_~",
                table: "risk_mitigations");

            migrationBuilder.DropForeignKey(
                name: "FK_risk_revisions_api_machine_identities_recorded_by_machine_id",
                table: "risk_revisions");

            migrationBuilder.DropForeignKey(
                name: "FK_risks_api_machine_identities_created_by_machine_id",
                table: "risks");

            migrationBuilder.DropIndex(
                name: "IX_risks_created_by_machine_id",
                table: "risks");

            migrationBuilder.DropCheckConstraint(
                name: "CK_risks_actor",
                table: "risks");

            migrationBuilder.DropIndex(
                name: "IX_risk_revisions_recorded_by_machine_id",
                table: "risk_revisions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_risk_revisions_actor",
                table: "risk_revisions");

            migrationBuilder.DropIndex(
                name: "IX_risk_mitigations_created_by_machine_id",
                table: "risk_mitigations");

            migrationBuilder.DropCheckConstraint(
                name: "CK_risk_mitigations_actor",
                table: "risk_mitigations");

            migrationBuilder.DropIndex(
                name: "IX_risk_mitigation_revisions_recorded_by_machine_id",
                table: "risk_mitigation_revisions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_risk_mitigation_revisions_actor",
                table: "risk_mitigation_revisions");

            migrationBuilder.DropIndex(
                name: "IX_decisions_created_by_machine_id",
                table: "decisions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_decisions_actor",
                table: "decisions");

            migrationBuilder.DropIndex(
                name: "IX_decision_revisions_recorded_by_machine_id",
                table: "decision_revisions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_decision_revisions_actor",
                table: "decision_revisions");

            migrationBuilder.DropColumn(
                name: "created_by_machine_id",
                table: "risks");

            migrationBuilder.DropColumn(
                name: "recorded_by_machine_id",
                table: "risk_revisions");

            migrationBuilder.DropColumn(
                name: "created_by_machine_id",
                table: "risk_mitigations");

            migrationBuilder.DropColumn(
                name: "recorded_by_machine_id",
                table: "risk_mitigation_revisions");

            migrationBuilder.DropColumn(
                name: "created_by_machine_id",
                table: "decisions");

            migrationBuilder.DropColumn(
                name: "recorded_by_machine_id",
                table: "decision_revisions");

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "risks",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "recorded_by_person_id",
                table: "risk_revisions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "risk_mitigations",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "recorded_by_person_id",
                table: "risk_mitigation_revisions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "created_by_person_id",
                table: "decisions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "recorded_by_person_id",
                table: "decision_revisions",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);
        }
    }
}
