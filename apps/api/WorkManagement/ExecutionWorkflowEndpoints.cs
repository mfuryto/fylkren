using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.ExecutionEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class ExecutionWorkflowEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/{runId:guid}/start", async (Guid runId, StartExecution request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, FylkrenOptions options, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.DefinitionId == null, ct);
            if (run is null || !await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var definition = await db.WorkflowDefinitions.Include(x => x.Steps).ThenInclude(x => x.Template).SingleOrDefaultAsync(x => x.Id == request.DefinitionId && x.SiteId == run.WorkItem.SiteId && x.IsActive && x.Kind == "execution", ct);
            var allowedOwners = await WorkLevelAuthorization.ConfigurationLineage(run.WorkItem.SiteId, [run.WorkItem.AssignedUnitId], db, ct);
            if (definition is null || definition.OwnerUnitId is not null && !allowedOwners.Contains(definition.OwnerUnitId.Value)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["definitionId"] = ["Velg en aktiv utførelsesflyt for dette nivået."] });
            var now = DateTimeOffset.UtcNow;
            run.Start(definition.Id, now);
            if (definition.Steps.Any(x => x.HasTimeline)) run.InitializeTimeline(DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(options.Localization.TimeZone)).DateTime));
            foreach (var step in definition.Steps.Where(x => x.Template != null)) db.ExecutionStepDocuments.Add(new ExecutionStepDocument(Guid.NewGuid(), run.Id, step.Id, step.Template!.Content, now));
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.workflow-started", "execution-run", run.Id, now));
            DomainEventRecorder.Record(db, "execution.started", run.WorkItem.SiteId, personId, "execution", run.Id, new { executionId = run.Id, taskId = run.WorkItemId, definitionId = definition.Id }, now);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record StartExecution(Guid DefinitionId);
}
