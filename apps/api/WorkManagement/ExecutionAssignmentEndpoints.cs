using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.ExecutionEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class ExecutionAssignmentEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/items/{itemId:guid}/claim", async (Guid itemId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && x.Status == "execution", ct);
            if (item is null) return Results.NotFound();
            if (!await WorkLevelAuthorization.BelongsToLevel(item.SiteId, item.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var run = await db.ExecutionRuns.SingleOrDefaultAsync(x => x.WorkItemId == itemId, ct);
            if (run is null) { run = new ExecutionRun(Guid.NewGuid(), itemId, personId, now); db.ExecutionRuns.Add(run); }
            else { if (run.ClaimedByPersonId is not null && run.ClaimedByPersonId != personId) return Results.Conflict(new { error = "Another user has claimed execution." }); run.Claim(personId, now); }
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), item.SiteId, personId, "execution.claimed", "execution-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPost("/{runId:guid}/release", async (Guid runId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId != null && x.Status != "submitted", ct);
            if (run is null) return Results.NotFound();
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            run.Release(now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.released", "execution-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapGet("/{runId:guid}/candidates", async (Guid runId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.ExecutionRuns.AsNoTracking().Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId, ct);
            if (run is null) return Results.NotFound();
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var people = await db.SiteMemberships.AsNoTracking().Where(x =>
                x.SiteId == run.WorkItem.SiteId && x.IsActive && x.Site.IsActive && x.Person.IsActive)
                .Select(x => new { x.PersonId, x.Person.DisplayName }).OrderBy(x => x.DisplayName).ToListAsync(ct);
            var candidates = new List<ExecutionCandidate>();
            foreach (var person in people) if (await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, person.PersonId, db, ct)) candidates.Add(new ExecutionCandidate(person.PersonId, person.DisplayName));
            return Results.Ok(candidates);
        });

        group.MapPost("/{runId:guid}/reassign", async (Guid runId, ReassignExecution request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.Status != "submitted" && x.Status != "cancelled", ct);
            if (run is null) return Results.NotFound();
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct) || !await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, request.PersonId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            run.Claim(request.PersonId, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.reassigned", "execution-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record ExecutionCandidate(Guid PersonId, string DisplayName);
    private sealed record ReassignExecution(Guid PersonId);
}
