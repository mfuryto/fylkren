using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261005231500_VersionMachineSecretVerifiers")]
public partial class VersionMachineSecretVerifiers : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<string>(name: "secret_algorithm", table: "api_machine_identities",
            type: "character varying(40)", maxLength: 40, nullable: false, defaultValue: "pbkdf2-sha256");
        migrationBuilder.AddColumn<int>(name: "secret_hash_version", table: "api_machine_identities",
            type: "integer", nullable: false, defaultValue: 1);
        migrationBuilder.AddColumn<int>(name: "secret_iterations", table: "api_machine_identities",
            type: "integer", nullable: false, defaultValue: 210000);
        migrationBuilder.AddCheckConstraint(name: "ck_api_machine_secret_parameters", table: "api_machine_identities",
            sql: "secret_iterations BETWEEN 100000 AND 1000000 AND ((secret_algorithm = 'pbkdf2-sha256' AND secret_hash_version = 1) OR (secret_algorithm = 'pbkdf2-sha512' AND secret_hash_version = 2))");
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropCheckConstraint(name: "ck_api_machine_secret_parameters", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "secret_algorithm", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "secret_hash_version", table: "api_machine_identities");
        migrationBuilder.DropColumn(name: "secret_iterations", table: "api_machine_identities");
    }
}
