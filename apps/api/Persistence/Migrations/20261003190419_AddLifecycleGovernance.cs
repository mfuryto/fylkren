using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddLifecycleGovernance : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "archive_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    can_export = table.Column<bool>(type: "boolean", nullable: false),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    version = table.Column<long>(type: "bigint", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_archive_grants", x => x.id);
                    table.ForeignKey(
                        name: "FK_archive_grants_people_person_id",
                        column: x => x.person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_archive_grants_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "lifecycle_holds",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    lifecycle_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    released_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    released_by_person_id = table.Column<Guid>(type: "uuid", nullable: true),
                    release_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lifecycle_holds", x => x.id);
                    table.ForeignKey(
                        name: "FK_lifecycle_holds_information_lifecycle_lifecycle_id",
                        column: x => x.lifecycle_id,
                        principalTable: "information_lifecycle",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lifecycle_holds_people_created_by_person_id",
                        column: x => x.created_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_lifecycle_holds_people_released_by_person_id",
                        column: x => x.released_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "retention_policy_versions",
                columns: table => new
                {
                    policy_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    category = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    review_after_days = table.Column<int>(type: "integer", nullable: true),
                    created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_retention_policy_versions", x => new { x.policy_id, x.version });
                    table.ForeignKey(
                        name: "FK_retention_policy_versions_people_created_by_person_id",
                        column: x => x.created_by_person_id,
                        principalTable: "people",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_information_lifecycle_policy_id_policy_version",
                table: "information_lifecycle",
                columns: new[] { "policy_id", "policy_version" });

            migrationBuilder.CreateIndex(
                name: "IX_archive_grants_person_id",
                table: "archive_grants",
                column: "person_id");

            migrationBuilder.CreateIndex(
                name: "IX_archive_grants_site_id_person_id",
                table: "archive_grants",
                columns: new[] { "site_id", "person_id" },
                unique: true,
                filter: "is_active");

            migrationBuilder.CreateIndex(
                name: "IX_lifecycle_holds_created_by_person_id",
                table: "lifecycle_holds",
                column: "created_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_lifecycle_holds_lifecycle_id_released_at",
                table: "lifecycle_holds",
                columns: new[] { "lifecycle_id", "released_at" });

            migrationBuilder.CreateIndex(
                name: "IX_lifecycle_holds_released_by_person_id",
                table: "lifecycle_holds",
                column: "released_by_person_id");

            migrationBuilder.CreateIndex(
                name: "IX_retention_policy_versions_created_by_person_id",
                table: "retention_policy_versions",
                column: "created_by_person_id");

            migrationBuilder.AddForeignKey(
                name: "FK_information_lifecycle_retention_policy_versions_policy_id_p~",
                table: "information_lifecycle",
                columns: new[] { "policy_id", "policy_version" },
                principalTable: "retention_policy_versions",
                principalColumns: new[] { "policy_id", "version" },
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_information_lifecycle_retention_policy_versions_policy_id_p~",
                table: "information_lifecycle");

            migrationBuilder.DropTable(
                name: "archive_grants");

            migrationBuilder.DropTable(
                name: "lifecycle_holds");

            migrationBuilder.DropTable(
                name: "retention_policy_versions");

            migrationBuilder.DropIndex(
                name: "IX_information_lifecycle_policy_id_policy_version",
                table: "information_lifecycle");
        }
    }
}
