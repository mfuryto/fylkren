using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260925120000_AddFederationOfficialAnswer")]
public partial class AddFederationOfficialAnswer : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<Guid>("official_answer_message_id", "federation_work_links",
            type: "uuid", nullable: true);
        migrationBuilder.AddColumn<string>("official_answer", "federation_work_links",
            type: "character varying(100000)", maxLength: 100_000, nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>("official_answer_approved_at", "federation_work_links",
            type: "timestamp with time zone", nullable: true);
        migrationBuilder.CreateIndex("IX_federation_work_links_official_answer_message_id",
            "federation_work_links", "official_answer_message_id", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex("IX_federation_work_links_official_answer_message_id",
            "federation_work_links");
        migrationBuilder.DropColumn("official_answer_message_id", "federation_work_links");
        migrationBuilder.DropColumn("official_answer", "federation_work_links");
        migrationBuilder.DropColumn("official_answer_approved_at", "federation_work_links");
    }
}
