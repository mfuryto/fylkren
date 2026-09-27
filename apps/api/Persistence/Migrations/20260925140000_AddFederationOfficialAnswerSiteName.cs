using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260925140000_AddFederationOfficialAnswerSiteName")]
public partial class AddFederationOfficialAnswerSiteName : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>("official_answer_site_name", "federation_work_links",
            type: "character varying(200)", maxLength: 200, nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("official_answer_site_name", "federation_work_links");
    }
}
