using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20261002133000_PreserveSiteOwnedWorkContent")]
public sealed class PreserveSiteOwnedWorkContent : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        // Site templates and workflow labels are customer-owned after Site creation.
        // Restore only complete legacy default sets changed by the earlier translation
        // migration; a partially or fully customized workflow never matches these guards.
        migrationBuilder.Sql("""
            WITH legacy_planning AS (
                SELECT definition.id
                FROM workflow_definitions AS definition
                INNER JOIN sites AS site ON site.id = definition.site_id
                WHERE site.created_at < TIMESTAMPTZ '2026-10-01 16:00:00+00'
                  AND definition.kind = 'planning'
                  AND definition.owner_unit_id IS NULL
                  AND definition.name = 'Standard'
                  AND (SELECT COUNT(*) FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id) = 4
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 0 AND candidate.name = 'Analysis' AND candidate.has_timeline = TRUE)
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 1 AND candidate.name = 'Task')
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 2 AND candidate.name = 'Intent')
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 3 AND candidate.name = 'Plan' AND candidate.allows_task_allocation = TRUE)
            )
            UPDATE workflow_steps AS step
            SET name = CASE step.sort_order
                WHEN 0 THEN convert_from(decode('QW5hbHlzZQ==', 'base64'), 'UTF8')
                WHEN 1 THEN convert_from(decode('T3BwZHJhZw==', 'base64'), 'UTF8')
                WHEN 2 THEN convert_from(decode('SW50ZW5zam9u', 'base64'), 'UTF8')
                ELSE step.name
            END
            WHERE step.definition_id IN (SELECT id FROM legacy_planning)
              AND step.sort_order IN (0, 1, 2);

            WITH legacy_execution AS (
                SELECT definition.id
                FROM workflow_definitions AS definition
                INNER JOIN sites AS site ON site.id = definition.site_id
                WHERE site.created_at < TIMESTAMPTZ '2026-10-01 16:00:00+00'
                  AND definition.kind = 'execution'
                  AND definition.owner_unit_id IS NULL
                  AND definition.name = 'Standard'
                  AND (SELECT COUNT(*) FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id) = 3
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 0 AND candidate.name = 'Preparation')
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 1 AND candidate.name = 'Execution')
                  AND EXISTS (SELECT 1 FROM workflow_steps AS candidate WHERE candidate.definition_id = definition.id AND candidate.sort_order = 2 AND candidate.name = 'Closure and follow-up')
            )
            UPDATE workflow_steps AS step
            SET name = CASE step.sort_order
                WHEN 0 THEN convert_from(decode('Rm9yYmVyZWRlbHNlcg==', 'base64'), 'UTF8')
                WHEN 1 THEN convert_from(decode('R2plbm5vbWbDuHJpbmc=', 'base64'), 'UTF8')
                WHEN 2 THEN convert_from(decode('QXZzbHV0bmluZyBvZyBldHRlcmFyYmVpZA==', 'base64'), 'UTF8')
                ELSE step.name
            END
            WHERE step.definition_id IN (SELECT id FROM legacy_execution);

            UPDATE sites
            SET final_report_template = convert_from(decode('IyBTYW1tZW5kcmFnCgojIEdqZW5ub21mw7hyaW5nCgojIEtvbmtsdXNqb24=', 'base64'), 'UTF8')
            WHERE created_at < TIMESTAMPTZ '2026-10-01 16:00:00+00'
              AND (final_report_template IS NULL
                OR final_report_template = '# Summary\n\n# Execution\n\n# Conclusion'
                OR final_report_template = E'# Summary\n\n# Execution\n\n# Conclusion');

            UPDATE sites
            SET final_report_template = E'# Summary\n\n# Execution\n\n# Conclusion'
            WHERE final_report_template IS NULL;
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        // Reversing this migration would modify Site-owned content again.
    }
}
