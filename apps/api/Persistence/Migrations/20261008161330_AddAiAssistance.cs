using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddAiAssistance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ai_settings",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    enabled = table.Column<bool>(type: "boolean", nullable: false),
                    endpoint_url = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: false),
                    model = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    protected_api_key = table.Column<string>(type: "character varying(8000)", maxLength: 8000, nullable: true),
                    summary_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    drafts_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    learning_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    questions_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    last_tested_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_test_succeeded = table.Column<bool>(type: "boolean", nullable: true),
                    last_test_error = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_settings", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "ai_site_access",
                columns: table => new
                {
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ai_site_access", x => x.site_id);
                    table.ForeignKey(
                        name: "FK_ai_site_access_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ai_settings");

            migrationBuilder.DropTable(
                name: "ai_site_access");
        }
    }
}
