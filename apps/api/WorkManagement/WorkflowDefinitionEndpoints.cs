using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class WorkflowDefinitionEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}", async (Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!Pid(user, out var personId) || !await SiteAdministrator(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            return Results.Ok(await db.WorkflowDefinitions.AsNoTracking()
                .Where(x => x.IsActive && x.SiteId == siteId)
                .OrderBy(x => x.Kind).ThenBy(x => x.Name)
                .Select(x => new { x.Id, x.Name, x.Kind, x.IsSystem, x.OwnerUnitId, ownerUnitName = x.OwnerUnit == null ? null : x.OwnerUnit.Name, canEdit = true, steps = x.Steps.OrderBy(s => s.SortOrder).Select(s => new { s.Id, s.Name, s.SortOrder, s.IsOptional, s.AllowsTaskAllocation, s.HasTimeline, s.TemplateId, templateName = s.Template == null ? null : s.Template.Name }) })
                .ToListAsync(ct));
        });

        group.MapPost("/sites/{siteId:guid}", async (Guid siteId, CreateWorkflow request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId) || !await CanCreate(siteId, request.OwnerUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (!await IsValid(siteId, request, false, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["workflow"] = ["Kontroller navn, steg, tidslinjal og malvalg."] });
            if (request.Kind == "planning")
            {
                if (request.OwnerUnitId is not null || !request.Steps.Any(x => x.AllowsTaskAllocation)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["workflow"] = ["Planleggerflyten må ha et steg for oppgavefordeling."] });
                var previous = await db.WorkflowDefinitions.Where(x => x.SiteId == siteId && x.Kind == "planning" && x.IsActive).ToListAsync(ct);
                foreach (var previousDefinition in previous) previousDefinition.Deactivate();
            }
            var definition = CreateDefinition(siteId, request.Kind == "planning" ? null : request.OwnerUnitId, request, db);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, request.Kind == "planning" ? "planning-workflow.configured" : "execution-workflow.created", "workflow-definition", definition.Id, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/workflows/sites/{siteId}/{definition.Id}", new { definition.Id });
        });

        group.MapPut("/sites/{siteId:guid}/{definitionId:guid}", async (Guid siteId, Guid definitionId, CreateWorkflow request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var current = await db.WorkflowDefinitions.SingleOrDefaultAsync(x => x.Id == definitionId && x.SiteId == siteId && x.IsActive, ct);
            if (current is null) return Results.NotFound();
            var isPlanning = current.Kind == "planning";
            if (request.Kind != current.Kind || request.OwnerUnitId != current.OwnerUnitId || !await SiteAdministrator(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (!await IsValid(siteId, request, isPlanning, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["workflow"] = ["Kontroller navn, steg, tidslinjal og malvalg. Planleggerflyten må ha et steg for oppgavefordeling."] });
            current.Deactivate();
            var replacement = CreateDefinition(siteId, isPlanning ? null : request.OwnerUnitId, request, db);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "workflow.revised", "workflow-definition", replacement.Id, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { replacement.Id, replaces = definitionId });
        });

        group.MapDelete("/sites/{siteId:guid}/{definitionId:guid}", async (Guid siteId, Guid definitionId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId) || !await SiteAdministrator(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var definition = await db.WorkflowDefinitions.SingleOrDefaultAsync(x => x.Id == definitionId && x.SiteId == siteId && x.IsActive, ct);
            if (definition is null) return Results.NotFound();
            definition.Deactivate();
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "workflow.deactivated", "workflow-definition", definition.Id, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static async Task<bool> CanCreate(Guid siteId, Guid? unitId, Guid personId, FylkrenDbContext db, CancellationToken ct) =>
        await SiteAdministrator(siteId, personId, db, ct) && (unitId is null || await db.OrganizationUnits.AnyAsync(x => x.Id == unitId && x.SiteId == siteId && x.IsActive, ct));

    private static async Task<bool> IsValid(Guid siteId, CreateWorkflow request, bool requireAllocation, FylkrenDbContext db, CancellationToken ct)
    {
        if ((request.Name ?? "").Trim().Length is < 2 or > 200 || request.Steps is null || request.Steps.Count is < 1 or > 30 || request.Steps.Any(x => (x.Name ?? "").Trim().Length is < 2 or > 200) || request.Steps.Count(x => x.HasTimeline) > 1 || request.Kind is not ("planning" or "execution") || requireAllocation && !request.Steps.Any(x => x.AllowsTaskAllocation)) return false;
        var templateIds = request.Steps.Where(x => x.TemplateId.HasValue).Select(x => x.TemplateId!.Value).Distinct().ToList();
        return templateIds.Count == 0 || await db.WorkflowStepTemplates.CountAsync(x => templateIds.Contains(x.Id) && x.SiteId == siteId && x.IsActive, ct) == templateIds.Count;
    }

    private static WorkflowDefinition CreateDefinition(Guid siteId, Guid? ownerUnitId, CreateWorkflow request, FylkrenDbContext db)
    {
        var definition = new WorkflowDefinition(Guid.NewGuid(), siteId, ownerUnitId, request.Name, request.Kind, false);
        db.WorkflowDefinitions.Add(definition);
        for (var index = 0; index < request.Steps.Count; index++)
        {
            var step = request.Steps[index];
            db.WorkflowSteps.Add(new WorkflowStep(Guid.NewGuid(), definition.Id, step.Name, index, step.IsOptional, step.AllowsTaskAllocation, step.TemplateId, step.HasTimeline));
        }
        return definition;
    }
}
