using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.ExecutionEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class ExecutionDocumentEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPut("/{runId:guid}/steps/{stepId:guid}", async (Guid runId, Guid stepId, DocumentRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var events = request.TimelineEvents ?? [];
            var content = request.Content ?? "";
            if (content.Length > 20000 || events.Count > 100 || events.Any(x => string.IsNullOrWhiteSpace(x.Description) || x.Description.Trim().Length > 1000)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["content"] = ["Check the text and timeline."] });
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            var step = run is null ? null : await db.WorkflowSteps.SingleOrDefaultAsync(x => x.Id == stepId && x.DefinitionId == run.DefinitionId, ct);
            if (run is null || step is null || !await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct) || events.Count > 0 && !step.HasTimeline || events.Any(x => run.TimelineStartedOn.HasValue && x.Date < run.TimelineStartedOn.Value)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var document = await db.ExecutionStepDocuments.SingleOrDefaultAsync(x => x.RunId == runId && x.StepId == stepId, ct);
            if (document is null) db.ExecutionStepDocuments.Add(new ExecutionStepDocument(Guid.NewGuid(), runId, stepId, content, now)); else document.Update(content, now);
            db.ExecutionTimelineEvents.RemoveRange(await db.ExecutionTimelineEvents.Where(x => x.RunId == runId && x.StepId == stepId).ToListAsync(ct));
            for (var index = 0; index < events.Count; index++) db.ExecutionTimelineEvents.Add(new ExecutionTimelineEvent(Guid.NewGuid(), runId, stepId, events[index].Date, events[index].Description!.Trim(), index));
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.step-documented", "execution-step", stepId, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPost("/{runId:guid}/step", async (Guid runId, StepRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var count = await db.WorkflowSteps.CountAsync(x => x.DefinitionId == run.DefinitionId, ct);
            if (request.Step < 0 || request.Step >= count) return Results.ValidationProblem(new Dictionary<string, string[]> { ["step"] = ["Invalid step."] });
            var now = DateTimeOffset.UtcNow;
            run.Advance(request.Step, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.step-changed", "execution-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record StepRequest(int Step);
    private sealed record TimelineEventRequest(DateOnly Date, string? Description);
    private sealed record DocumentRequest(string? Content, IReadOnlyList<TimelineEventRequest>? TimelineEvents);
}
