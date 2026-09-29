using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260929120000_BindExternalIdentityProviderInstances")]
public sealed class BindExternalIdentityProviderInstances : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_external_identity_links_provider_subject_id",
            table: "external_identity_links");

        migrationBuilder.AddColumn<string>(
            name: "provider_instance_id",
            table: "external_identity_links",
            type: "character varying(1000)",
            maxLength: 1000,
            nullable: false,
            defaultValue: "");

        migrationBuilder.CreateIndex(
            name: "IX_external_identity_links_provider_provider_instance_id_subject_id",
            table: "external_identity_links",
            columns: new[] { "provider", "provider_instance_id", "subject_id" },
            unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropIndex(
            name: "IX_external_identity_links_provider_provider_instance_id_subject_id",
            table: "external_identity_links");

        migrationBuilder.DropColumn(
            name: "provider_instance_id",
            table: "external_identity_links");

        migrationBuilder.CreateIndex(
            name: "IX_external_identity_links_provider_subject_id",
            table: "external_identity_links",
            columns: new[] { "provider", "subject_id" },
            unique: true);
    }
}
