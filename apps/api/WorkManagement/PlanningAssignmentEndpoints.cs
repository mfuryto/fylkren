using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningAssignmentEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/planning/{runId:guid}/claim", async (Guid runId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId, ct);
            if (run is null) return Results.NotFound();
            if (!await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (run.Status is not ("available" or "in_progress")) return Results.Conflict(new { error = "Planleggingen kan ikke tas i denne statusen." });
            if (run.ClaimedByPersonId is not null && run.ClaimedByPersonId != personId) return Results.Conflict(new { error = "En annen planlegger har tatt ansvar." });
            var now = DateTimeOffset.UtcNow;
            run.Claim(personId, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.claimed", "workflow-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapGet("/planning/{runId:guid}/candidates", async (Guid runId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.AsNoTracking().Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId, ct);
            if (run is null) return Results.NotFound();
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var targetUnitId = run.WorkItem.AssignedUnitId ?? await db.OrganizationUnits.Where(x => x.SiteId == run.WorkItem.SiteId && x.IsActive && x.IsSiteLeadership).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
            if (targetUnitId is null) return Results.Ok(Array.Empty<PlanningCandidate>());
            var now = DateTimeOffset.UtcNow;
            var candidates = await db.RoleAssignments.AsNoTracking()
                .Where(x => x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) &&
                    x.Person.IsActive && x.Person.SiteMemberships.Any(m =>
                        m.SiteId == run.WorkItem.SiteId && m.IsActive && m.Site.IsActive) &&
                    x.Role.IsActive && x.Role.OrganizationUnit.SiteId == run.WorkItem.SiteId &&
                    x.Role.OrganizationUnit.Site.IsActive &&
                    (x.Role.OrganizationUnitId == targetUnitId && (x.Role.CanPlan || x.Role.IsLeader || x.Role.HasLeaderAccess) ||
                     x.Role.OrganizationUnit.IsActive && x.Role.OrganizationUnit.WorksAtParentLevel &&
                     (x.Role.OrganizationUnit.ParentId == targetUnitId || x.Role.OrganizationUnit.Parent != null && x.Role.OrganizationUnit.Parent.IsSiteRoot) &&
                     (x.Role.CanPlan || x.Role.IsLeader && x.CanLeadParentLevel)))
                .Select(x => new PlanningCandidate(x.PersonId, x.Person.DisplayName)).Distinct().OrderBy(x => x.DisplayName).ToListAsync(ct);
            return Results.Ok(candidates);
        });

        group.MapPost("/planning/{runId:guid}/release", async (Guid runId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId, ct);
            if (run is null) return Results.NotFound();
            if (run.Status != "in_progress" || run.ClaimedByPersonId is null) return Results.Conflict(new { error = "Planleggingen er ikke låst til en bruker." });
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            run.Release();
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.released", "workflow-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPost("/planning/{runId:guid}/reassign", async (Guid runId, ReassignPlanning request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId, ct);
            if (run is null) return Results.NotFound();
            if (run.Status != "in_progress" || run.ClaimedByPersonId is null) return Results.Conflict(new { error = "Planleggingen er ikke låst til en bruker." });
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct) || !await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, request.PersonId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            run.Claim(request.PersonId, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.reassigned", "workflow-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record PlanningCandidate(Guid PersonId, string DisplayName);
    private sealed record ReassignPlanning(Guid PersonId);
}
