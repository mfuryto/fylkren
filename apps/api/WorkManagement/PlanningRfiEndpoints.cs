using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningRfiEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/planning/{runId:guid}/rfi", async (Guid runId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.AsNoTracking().Where(x => x.Id == runId && x.Definition.Kind == "planning")
                .Select(x => new { x.WorkItem.SiteId, x.WorkItem.AssignedUnitId }).SingleOrDefaultAsync(ct);
            if (run is null) return Results.NotFound();
            if (!await OrganizationAuthorization.CanPlanAtLevel(run.SiteId, run.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var entries = await db.PlanningRfiEntries.AsNoTracking().Where(x => x.RunId == runId).OrderBy(x => x.CreatedAt).ThenBy(x => x.Id)
                .Select(x => new { x.Id, x.Who, x.What, x.DueOn, x.Answered, x.Answer, x.CreatedAt, x.UpdatedAt }).ToListAsync(ct);
            return Results.Ok(entries);
        });

        group.MapPost("/planning/{runId:guid}/rfi", async (Guid runId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await EditableRun(runId, personId, db, ct);
            if (run is null) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var entry = new PlanningRfiEntry(Guid.NewGuid(), runId, "", "", null, false, "", now);
            db.PlanningRfiEntries.Add(entry);
            WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "planning.rfi-created", "planning-rfi", entry.Id, now), "plan.updated", workItemId: run.WorkItemId, resourceType: "plan", resourceId: run.Id, metadataJson: "{\"changedFields\":\"rfi\"}");
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/workflows/planning/{runId}/rfi/{entry.Id}", new { entry.Id, entry.Who, entry.What, entry.DueOn, entry.Answered, entry.Answer, entry.CreatedAt, entry.UpdatedAt });
        });

        group.MapPut("/planning/{runId:guid}/rfi/{entryId:guid}", async (Guid runId, Guid entryId, RfiUpdate request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await EditableRun(runId, personId, db, ct);
            if (run is null) return Results.Problem(statusCode: 403);
            var entry = await db.PlanningRfiEntries.SingleOrDefaultAsync(x => x.Id == entryId && x.RunId == runId, ct);
            if (entry is null) return Results.NotFound();
            var who = (request.Who ?? "").Trim(); var what = (request.What ?? "").Trim(); var answer = (request.Answer ?? "").Trim();
            if (who.Length > 320 || what.Length > 10000 || answer.Length > 10000)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["rfi"] = ["Check the length of Who, What, and Response."] });
            var now = DateTimeOffset.UtcNow;
            entry.Update(who, what, request.DueOn, request.Answered, answer, now);
            WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "planning.rfi-updated", "planning-rfi", entry.Id, now), "plan.updated", workItemId: run.WorkItemId, resourceType: "plan", resourceId: run.Id, metadataJson: "{\"changedFields\":\"rfi\"}");
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapDelete("/planning/{runId:guid}/rfi/{entryId:guid}", async (Guid runId, Guid entryId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await EditableRun(runId, personId, db, ct);
            if (run is null) return Results.Problem(statusCode: 403);
            var entry = await db.PlanningRfiEntries.SingleOrDefaultAsync(x => x.Id == entryId && x.RunId == runId, ct);
            if (entry is null) return Results.NotFound();
            db.PlanningRfiEntries.Remove(entry);
            WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "planning.rfi-removed", "planning-rfi", entry.Id, DateTimeOffset.UtcNow), "plan.updated", workItemId: run.WorkItemId, resourceType: "plan", resourceId: run.Id, metadataJson: "{\"changedFields\":\"rfi\"}");
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static async Task<WorkflowRun?> EditableRun(Guid runId, Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var run = await db.WorkflowRuns.Include(x => x.WorkItem).Include(x => x.Definition)
            .SingleOrDefaultAsync(x => x.Id == runId && x.Definition.Kind == "planning" && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
        return run is not null && await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct) ? run : null;
    }

    private sealed record RfiUpdate(string? Who, string? What, DateOnly? DueOn, bool Answered, string? Answer);
}
