using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningSubmissionEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPut("/planning/{runId:guid}/allocations", async (Guid runId, SaveAllocations request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).Include(x => x.Allocations).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (!await ValidAllocations(run, request.Allocations, db, ct, allowEmptyInstruction: true)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["allocations"] = ["Check the recipients and task text in the subtasks."] });
            ReconcileAllocations(run, request.Allocations!, db);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPost("/planning/{runId:guid}/submit", async (Guid runId, SubmitPlan request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).Include(x => x.Allocations).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (!await ValidAllocations(run, request.Allocations, db, ct) || request.Priority is not ("low" or "normal" or "high" or "critical")) return Results.ValidationProblem(new Dictionary<string, string[]> { ["plan"] = ["Check any task allocations and text lengths."] });
            ReconcileAllocations(run, request.Allocations!, db);
            var now = DateTimeOffset.UtcNow;
            run.Submit(request.Allocations.FirstOrDefault()?.UnitId, request.Priority, request.DueAt);
            run.WorkItem.TransitionWithinLevel("planning_approval", null, now);
            Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.submitted-for-approval", "workflow-run", run.Id, now), "plan.submitted", "planning-completed");
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static async Task<bool> ValidAllocations(WorkflowRun run, IReadOnlyList<PlanAllocation>? allocations, FylkrenDbContext db, CancellationToken ct, bool allowEmptyInstruction = false)
    {
        if (allocations is null || allocations.Count > 100 || allocations.Select(x => new { x.StepId, x.UnitId }).Distinct().Count() != allocations.Count) return false;
        var stepIds = await db.WorkflowSteps.Where(x => x.DefinitionId == run.DefinitionId && x.AllowsTaskAllocation).Select(x => x.Id).ToListAsync(ct);
        List<Guid> unitIds;
        if (run.WorkItem.AssignedUnitId is Guid ownerUnitId)
        {
            unitIds = await db.OrganizationUnits.Where(x => x.SiteId == run.WorkItem.SiteId && x.IsActive && x.ParentId == ownerUnitId).Select(x => x.Id).ToListAsync(ct);
            unitIds.AddRange(await db.Sites.Where(x => x.IsActive && x.ParentOrganizationUnitId == ownerUnitId).SelectMany(x => x.OrganizationUnits.Where(unit => unit.IsActive && unit.IsSiteLeadership).Select(unit => unit.Id)).ToListAsync(ct));
        }
        else
        {
            var topLevelIds = await db.OrganizationUnits.Where(x => x.SiteId == run.WorkItem.SiteId && x.IsActive && (x.IsSiteRoot || x.IsSiteLeadership)).Select(x => x.Id).ToListAsync(ct);
            unitIds = await db.OrganizationUnits.Where(x => x.SiteId == run.WorkItem.SiteId && x.IsActive && !x.IsSiteRoot && !x.IsSiteLeadership && x.ParentId != null && topLevelIds.Contains(x.ParentId.Value)).Select(x => x.Id).ToListAsync(ct);
            unitIds.AddRange(await db.Sites.Where(x => x.IsActive && x.ParentOrganizationUnitId != null && topLevelIds.Contains(x.ParentOrganizationUnitId.Value)).SelectMany(x => x.OrganizationUnits.Where(unit => unit.IsActive && unit.IsSiteLeadership).Select(unit => unit.Id)).ToListAsync(ct));
        }
        return allocations.All(x => stepIds.Contains(x.StepId) && unitIds.Contains(x.UnitId) && x.Instruction is not null && (allowEmptyInstruction || !string.IsNullOrWhiteSpace(x.Instruction)) && x.Instruction.Trim().Length <= 10000);
    }

    private static void ReconcileAllocations(WorkflowRun run, IReadOnlyList<PlanAllocation> requested, FylkrenDbContext db)
    {
        foreach (var existing in run.Allocations.ToList())
        {
            if (requested.Any(x => x.StepId == existing.StepId && x.UnitId == existing.UnitId)) continue;
            db.WorkflowPlanAllocations.Remove(existing);
        }
        foreach (var allocation in requested)
        {
            var existing = run.Allocations.FirstOrDefault(x => x.StepId == allocation.StepId && x.UnitId == allocation.UnitId);
            if (existing is null) db.WorkflowPlanAllocations.Add(new WorkflowPlanAllocation(Guid.NewGuid(), run.Id, allocation.StepId, allocation.UnitId, allocation.Instruction));
            else existing.UpdateInstruction(allocation.Instruction);
        }
    }

    private sealed record PlanAllocation(Guid StepId, Guid UnitId, string Instruction);
    private sealed record SaveAllocations(IReadOnlyList<PlanAllocation>? Allocations);
    private sealed record SubmitPlan(string Priority, DateTimeOffset? DueAt, IReadOnlyList<PlanAllocation> Allocations);
}
