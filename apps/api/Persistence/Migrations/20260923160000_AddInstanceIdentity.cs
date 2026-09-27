using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260923160000_AddInstanceIdentity")]
public partial class AddInstanceIdentity : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable(
            name: "instance_identity",
            columns: table => new
            {
                key = table.Column<int>(type: "integer", nullable: false),
                instance_id = table.Column<Guid>(type: "uuid", nullable: false),
                created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_instance_identity", x => x.key));
        migrationBuilder.CreateIndex("IX_instance_identity_instance_id", "instance_identity", "instance_id", unique: true);
        migrationBuilder.Sql("INSERT INTO instance_identity (key, instance_id, created_at) VALUES (1, gen_random_uuid(), now())");
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("instance_identity");
}
