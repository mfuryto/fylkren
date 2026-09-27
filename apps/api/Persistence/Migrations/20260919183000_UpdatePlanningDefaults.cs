using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Fylkren.Api.Persistence.Migrations;

[DbContext(typeof(FylkrenDbContext))]
[Migration("20260919183000_UpdatePlanningDefaults")]
public sealed class UpdatePlanningDefaults : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE workflow_definitions
            SET name = 'Standard'
            WHERE kind = 'planning'
              AND owner_unit_id IS NULL
              AND name = 'Standard planlegging';

            UPDATE workflow_steps AS step
            SET name = 'Plan'
            FROM workflow_definitions AS definition
            WHERE step.definition_id = definition.id
              AND definition.kind = 'planning'
              AND definition.owner_unit_id IS NULL
              AND definition.name = 'Standard'
              AND step.sort_order = 3
              AND step.allows_task_allocation = TRUE
              AND step.name = 'Oppgaver';
            """);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.Sql("""
            UPDATE workflow_steps AS step
            SET name = 'Oppgaver'
            FROM workflow_definitions AS definition
            WHERE step.definition_id = definition.id
              AND definition.kind = 'planning'
              AND definition.owner_unit_id IS NULL
              AND definition.name = 'Standard'
              AND step.sort_order = 3
              AND step.allows_task_allocation = TRUE
              AND step.name = 'Plan';

            UPDATE workflow_definitions
            SET name = 'Standard planlegging'
            WHERE kind = 'planning'
              AND owner_unit_id IS NULL
              AND name = 'Standard';
            """);
    }
}
