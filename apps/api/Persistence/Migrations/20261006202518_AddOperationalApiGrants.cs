using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOperationalApiGrants : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_work_items_external_creator",
                table: "work_items");

            migrationBuilder.AddColumn<Guid>(
                name: "created_by_machine_id",
                table: "work_items",
                type: "uuid",
                nullable: true);

            migrationBuilder.AlterColumn<Guid>(
                name: "author_person_id",
                table: "work_item_comments",
                type: "uuid",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uuid");

            migrationBuilder.AddColumn<Guid>(
                name: "author_machine_id",
                table: "work_item_comments",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "api_work_grants",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    machine_identity_id = table.Column<Guid>(type: "uuid", nullable: false),
                    site_id = table.Column<Guid>(type: "uuid", nullable: false),
                    organization_unit_id = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_api_work_grants", x => x.id);
                    table.ForeignKey(
                        name: "FK_api_work_grants_api_machine_identities_machine_identity_id",
                        column: x => x.machine_identity_id,
                        principalTable: "api_machine_identities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_api_work_grants_organization_units_organization_unit_id",
                        column: x => x.organization_unit_id,
                        principalTable: "organization_units",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_api_work_grants_sites_site_id",
                        column: x => x.site_id,
                        principalTable: "sites",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_work_items_created_by_machine_id",
                table: "work_items",
                column: "created_by_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_work_items_external_creator",
                table: "work_items",
                sql: "created_by_person_id IS NOT NULL OR created_by_machine_id IS NOT NULL OR NULLIF(BTRIM(sender_site_name), '') IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_work_item_comments_author_machine_id",
                table: "work_item_comments",
                column: "author_machine_id");

            migrationBuilder.AddCheckConstraint(
                name: "CK_work_item_comments_author",
                table: "work_item_comments",
                sql: "author_person_id IS NOT NULL OR author_machine_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_api_work_grants_machine_identity_id_site_id_organization_un~",
                table: "api_work_grants",
                columns: new[] { "machine_identity_id", "site_id", "organization_unit_id" },
                unique: true)
                .Annotation("Npgsql:NullsDistinct", false);

            migrationBuilder.CreateIndex(
                name: "IX_api_work_grants_organization_unit_id",
                table: "api_work_grants",
                column: "organization_unit_id");

            migrationBuilder.CreateIndex(
                name: "IX_api_work_grants_site_id",
                table: "api_work_grants",
                column: "site_id");

            migrationBuilder.AddForeignKey(
                name: "FK_work_item_comments_api_machine_identities_author_machine_id",
                table: "work_item_comments",
                column: "author_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_work_items_api_machine_identities_created_by_machine_id",
                table: "work_items",
                column: "created_by_machine_id",
                principalTable: "api_machine_identities",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_work_item_comments_api_machine_identities_author_machine_id",
                table: "work_item_comments");

            migrationBuilder.DropForeignKey(
                name: "FK_work_items_api_machine_identities_created_by_machine_id",
                table: "work_items");

            migrationBuilder.DropTable(
                name: "api_work_grants");

            migrationBuilder.DropIndex(
                name: "IX_work_items_created_by_machine_id",
                table: "work_items");

            migrationBuilder.DropCheckConstraint(
                name: "CK_work_items_external_creator",
                table: "work_items");

            migrationBuilder.DropIndex(
                name: "IX_work_item_comments_author_machine_id",
                table: "work_item_comments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_work_item_comments_author",
                table: "work_item_comments");

            migrationBuilder.DropColumn(
                name: "created_by_machine_id",
                table: "work_items");

            migrationBuilder.DropColumn(
                name: "author_machine_id",
                table: "work_item_comments");

            migrationBuilder.AlterColumn<Guid>(
                name: "author_person_id",
                table: "work_item_comments",
                type: "uuid",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AddCheckConstraint(
                name: "CK_work_items_external_creator",
                table: "work_items",
                sql: "created_by_person_id IS NOT NULL OR NULLIF(BTRIM(sender_site_name), '') IS NOT NULL");
        }
    }
}
