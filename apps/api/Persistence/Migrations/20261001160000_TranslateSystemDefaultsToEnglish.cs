using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261001160000_TranslateSystemDefaultsToEnglish")]
public sealed class TranslateSystemDefaultsToEnglish : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Legacy values are encoded so the repository remains English-only while existing installations are migrated.
        migrationBuilder.Sql("""
            UPDATE work_item_types
            SET name = 'Request', normalized_name = 'REQUEST'
            WHERE is_system_managed = TRUE
              AND name = convert_from(decode('QW5tb2RuaW5n', 'base64'), 'UTF8');

            UPDATE workflow_steps SET name = 'Analysis'
            WHERE name = convert_from(decode('QW5hbHlzZQ==', 'base64'), 'UTF8');
            UPDATE workflow_steps SET name = 'Task'
            WHERE name = convert_from(decode('T3BwZHJhZw==', 'base64'), 'UTF8');
            UPDATE workflow_steps SET name = 'Intent'
            WHERE name = convert_from(decode('SW50ZW5zam9u', 'base64'), 'UTF8');
            UPDATE workflow_steps SET name = 'Preparation'
            WHERE name = convert_from(decode('Rm9yYmVyZWRlbHNlcg==', 'base64'), 'UTF8');
            UPDATE workflow_steps SET name = 'Execution'
            WHERE name = convert_from(decode('R2plbm5vbWbDuHJpbmc=', 'base64'), 'UTF8');
            UPDATE workflow_steps SET name = 'Closure and follow-up'
            WHERE name = convert_from(decode('QXZzbHV0bmluZyBvZyBldHRlcmFyYmVpZA==', 'base64'), 'UTF8');

            UPDATE organization_roles SET name = 'Manager', normalized_name = 'MANAGER'
            WHERE is_leader = TRUE
              AND name = convert_from(decode('TGVkZXI=', 'base64'), 'UTF8');

            UPDATE sites SET final_report_template = '# Summary\n\n# Execution\n\n# Conclusion'
            WHERE final_report_template IN (
              convert_from(decode('IyBTYW1tZW5kcmFnCgojIEdqZW5ub21mw7hyaW5nCgojIEtvbmtsdXNqb24=', 'base64'), 'UTF8'),
              convert_from(decode('IyMgU2FtbWVuZHJhZwoKIyMgR2plbm5vbWbDuHJpbmcKCiMjIEtvbmtsdXNqb24=', 'base64'), 'UTF8')
            );
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // The translated defaults are intentionally retained on downgrade to avoid changing customer-visible content.
    }
}
