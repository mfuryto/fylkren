using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261002170000_AddWorkItemComments")]
public sealed class AddWorkItemComments : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.CreateTable("work_item_comments", table => new
        {
            id = table.Column<Guid>(type: "uuid", nullable: false),
            site_id = table.Column<Guid>(type: "uuid", nullable: false),
            work_item_id = table.Column<Guid>(type: "uuid", nullable: false),
            author_person_id = table.Column<Guid>(type: "uuid", nullable: false),
            author_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
            text = table.Column<string>(type: "character varying(10000)", maxLength: 10000, nullable: false),
            created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
        }, constraints: table =>
        {
            table.PrimaryKey("PK_work_item_comments", value => value.id);
            table.ForeignKey("FK_work_item_comments_sites_site_id", value => value.site_id, "sites", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_work_item_comments_work_items_work_item_id", value => value.work_item_id, "work_items", "id", onDelete: ReferentialAction.Restrict);
            table.ForeignKey("FK_work_item_comments_people_author_person_id", value => value.author_person_id, "people", "id", onDelete: ReferentialAction.Restrict);
        });
        migrationBuilder.CreateIndex("IX_work_item_comments_site_id", "work_item_comments", "site_id");
        migrationBuilder.CreateIndex("IX_work_item_comments_author_person_id", "work_item_comments", "author_person_id");
        migrationBuilder.CreateIndex("IX_work_item_comments_work_item_id_created_at_id", "work_item_comments", new[] { "work_item_id", "created_at", "id" });
    }

    protected override void Down(MigrationBuilder migrationBuilder) => migrationBuilder.DropTable("work_item_comments");
}
