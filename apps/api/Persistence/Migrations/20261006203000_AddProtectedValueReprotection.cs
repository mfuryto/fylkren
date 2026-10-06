using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261006203000_AddProtectedValueReprotection")]
public partial class AddProtectedValueReprotection : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "crypto_reprotection_operations",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                created_by_person_id = table.Column<Guid>(type: "uuid", nullable: false),
                backup_reference = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                rollback_reference = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: false),
                status = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                total_items = table.Column<int>(type: "integer", nullable: false),
                completed_items = table.Column<int>(type: "integer", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                failed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                failure_code = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_crypto_reprotection_operations", value => value.id);
                table.CheckConstraint("ck_crypto_reprotection_progress", "total_items >= 0 AND completed_items >= 0 AND completed_items <= total_items");
                table.CheckConstraint("ck_crypto_reprotection_status", "status IN ('pending','completed','failed')");
            });

        migrationBuilder.CreateTable(
            name: "crypto_reprotection_items",
            columns: table => new
            {
                id = table.Column<Guid>(type: "uuid", nullable: false),
                operation_id = table.Column<Guid>(type: "uuid", nullable: false),
                store = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                record_key = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                slot = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
            },
            constraints: table =>
            {
                table.PrimaryKey("PK_crypto_reprotection_items", value => value.id);
                table.ForeignKey(
                    name: "FK_crypto_reprotection_items_crypto_reprotection_operations_op~",
                    column: value => value.operation_id,
                    principalTable: "crypto_reprotection_operations",
                    principalColumn: "id",
                    onDelete: ReferentialAction.Cascade);
            });

        migrationBuilder.CreateIndex(
            name: "IX_crypto_reprotection_items_operation_id_completed_at_id",
            table: "crypto_reprotection_items",
            columns: new[] { "operation_id", "completed_at", "id" });
        migrationBuilder.CreateIndex(
            name: "IX_crypto_reprotection_items_operation_id_store_record_key_slot",
            table: "crypto_reprotection_items",
            columns: new[] { "operation_id", "store", "record_key", "slot" },
            unique: true);
        migrationBuilder.CreateIndex(
            name: "IX_crypto_reprotection_operations_status_created_at",
            table: "crypto_reprotection_operations",
            columns: new[] { "status", "created_at" });
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "crypto_reprotection_items");
        migrationBuilder.DropTable(name: "crypto_reprotection_operations");
    }
}
