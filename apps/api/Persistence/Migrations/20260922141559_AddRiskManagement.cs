using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRiskManagement : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "risks",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    object_type = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    object_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_risks", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "risk_mitigations",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    risk_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_risk_mitigations", x => x.id);
                    table.ForeignKey(
                        name: "FK_risk_mitigations_risks_risk_id",
                        column: x => x.risk_id,
                        principalTable: "risks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "risk_revisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    risk_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
                    probability = table.Column<int>(type: "integer", nullable: false),
                    impact = table.Column<int>(type: "integer", nullable: false),
                    score = table.Column<int>(type: "integer", nullable: false),
                    level = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    owner_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_name_snapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    due_date = table.Column<DateOnly>(type: "date", nullable: true),
                    residual_probability = table.Column<int>(type: "integer", nullable: true),
                    residual_impact = table.Column<int>(type: "integer", nullable: true),
                    residual_score = table.Column<int>(type: "integer", nullable: true),
                    residual_level = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: true),
                    recorded_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_risk_revisions", x => x.id);
                    table.ForeignKey(
                        name: "FK_risk_revisions_risks_risk_id",
                        column: x => x.risk_id,
                        principalTable: "risks",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "risk_mitigation_revisions",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    mitigation_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    action = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    owner_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    owner_name_snapshot = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    status = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    due_date = table.Column<DateOnly>(type: "date", nullable: true),
                    recorded_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_risk_mitigation_revisions", x => x.id);
                    table.ForeignKey(
                        name: "FK_risk_mitigation_revisions_risk_mitigations_mitigation_id",
                        column: x => x.mitigation_id,
                        principalTable: "risk_mitigations",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_risk_mitigation_revisions_mitigation_id_version",
                table: "risk_mitigation_revisions",
                columns: new[] { "mitigation_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_risk_mitigations_risk_id",
                table: "risk_mitigations",
                column: "risk_id");

            migrationBuilder.CreateIndex(
                name: "IX_risk_revisions_risk_id_version",
                table: "risk_revisions",
                columns: new[] { "risk_id", "version" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_risks_site_id_object_type_object_id",
                table: "risks",
                columns: new[] { "site_id", "object_type", "object_id" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "risk_mitigation_revisions");

            migrationBuilder.DropTable(
                name: "risk_revisions");

            migrationBuilder.DropTable(
                name: "risk_mitigations");

            migrationBuilder.DropTable(
                name: "risks");
        }
    }
}
