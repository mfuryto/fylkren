using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.ExecutionEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class ExecutionCompletionEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/{runId:guid}/submit", async (Guid runId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).Include(x => x.ExternalRequests).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (run.ExternalRequests.Any(x => x.Status == "awaiting_response")) return Results.Conflict(new { error = "External enquiries are still awaiting responses." });
            if (await db.WorkItems.AnyAsync(x => x.ParentWorkItemId == run.WorkItemId && x.Status != "completed" && x.Status != "reassigned", ct)) return Results.Conflict(new { error = "All direct subtasks must be completed and reported before execution can be submitted for review." });
            var now = DateTimeOffset.UtcNow;
            run.Submit(now);
            run.WorkItem.TransitionWithinLevel("in_review", null, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.submitted-for-review", "execution-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }
}
