using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningDocumentEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/planning/{runId:guid}/step", async (Guid runId, StepRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var count = await db.WorkflowSteps.CountAsync(x => x.DefinitionId == run.DefinitionId, ct);
            if (request.Step < 0 || request.Step >= count) return Results.ValidationProblem(new Dictionary<string, string[]> { ["step"] = ["Invalid step."] });
            run.Advance(request.Step);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPut("/planning/{runId:guid}/steps/{stepId:guid}", async (Guid runId, Guid stepId, StepDocumentRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var links = request.Links ?? [];
            var events = request.TimelineEvents ?? [];
            var content = request.Content ?? "";
            if (!Pid(user, out var personId) || content.Length > 20000 || links.Count > 30 || links.Any(link => !ValidLink(link)) || events.Count > 100 || events.Any(entry => string.IsNullOrWhiteSpace(entry.Description) || entry.Description.Trim().Length > 1000)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["content"] = ["Check the text, timeline, and document links."] });
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            var step = run is null ? null : await db.WorkflowSteps.SingleOrDefaultAsync(x => x.Id == stepId && x.DefinitionId == run.DefinitionId, ct);
            if (run is null || step is null || !await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct) || events.Count > 0 && !step.HasTimeline || events.Any(entry => run.TimelineStartedOn.HasValue && entry.Date < run.TimelineStartedOn.Value)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var document = await db.WorkflowStepDocuments.SingleOrDefaultAsync(x => x.RunId == runId && x.StepId == stepId, ct);
            if (document is null) db.WorkflowStepDocuments.Add(new WorkflowStepDocument(Guid.NewGuid(), runId, stepId, content, now)); else document.Update(content, now);
            db.WorkflowStepLinks.RemoveRange(await db.WorkflowStepLinks.Where(x => x.RunId == runId && x.StepId == stepId).ToListAsync(ct));
            foreach (var link in links)
            {
                WorkLinkPolicy.TryNormalize(link.Url, out var normalizedUrl);
                db.WorkflowStepLinks.Add(new WorkflowStepLink(Guid.NewGuid(), runId, stepId, link.Label!.Trim(), normalizedUrl!, now));
            }
            db.WorkflowTimelineEvents.RemoveRange(await db.WorkflowTimelineEvents.Where(x => x.RunId == runId && x.StepId == stepId).ToListAsync(ct));
            for (var index = 0; index < events.Count; index++) db.WorkflowTimelineEvents.Add(new WorkflowTimelineEvent(Guid.NewGuid(), runId, stepId, events[index].Date, events[index].Description!.Trim(), index));
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.step-documented", "workflow-run", run.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private static bool ValidLink(StepLinkRequest link)
    {
        return !string.IsNullOrWhiteSpace(link.Label) && link.Label.Trim().Length <= 240 && WorkLinkPolicy.TryNormalize(link.Url, out var normalized) && normalized is not null;
    }

    private sealed record StepRequest(int Step);
    private sealed record StepLinkRequest(string? Label, string? Url);
    private sealed record TimelineEventRequest(DateOnly Date, string? Description);
    private sealed record StepDocumentRequest(string? Content, IReadOnlyList<StepLinkRequest>? Links, IReadOnlyList<TimelineEventRequest>? TimelineEvents);
}
