using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260925130000_AddFederationProgress")]
public partial class AddFederationProgress : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<long>("remote_progress_sequence", "federation_work_links",
            type: "bigint", nullable: false, defaultValue: 0L);
        migrationBuilder.AddColumn<string>("remote_progress_status", "federation_work_links",
            type: "character varying(24)", maxLength: 24, nullable: true);
        migrationBuilder.AddColumn<DateTimeOffset>("remote_progress_at", "federation_work_links",
            type: "timestamp with time zone", nullable: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropColumn("remote_progress_sequence", "federation_work_links");
        migrationBuilder.DropColumn("remote_progress_status", "federation_work_links");
        migrationBuilder.DropColumn("remote_progress_at", "federation_work_links");
    }
}
