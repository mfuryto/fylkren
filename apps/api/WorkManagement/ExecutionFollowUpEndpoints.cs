using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.ExecutionEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class ExecutionFollowUpEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/{runId:guid}/external-requests", async (Guid runId, ExternalRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var recipient = (request.Recipient ?? "").Trim();
            var requestText = (request.RequestText ?? "").Trim();
            if (!PersonId(user, out var personId) || recipient.Length is < 2 or > 320 || requestText.Length is < 2 or > 10000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["Check the external contact and follow-up text."] });
            var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await WorkLevelAuthorization.BelongsToLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct) || !await db.WorkflowSteps.AnyAsync(x => x.Id == request.StepId && x.DefinitionId == run.DefinitionId, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var value = new ExecutionExternalRequest(Guid.NewGuid(), runId, request.StepId, recipient, requestText, now);
            db.ExecutionExternalRequests.Add(value);
            WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "execution.external-follow-up-recorded", "execution-external-request", value.Id, now), "execution.updated", workItemId: run.WorkItemId, resourceType: "execution", resourceId: run.Id, metadataJson: "{\"changedFields\":\"externalFollowUp\"}");
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPut("/external-requests/{requestId:guid}/response", async (Guid requestId, ResponseRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var responseText = (request.ResponseText ?? "").Trim();
            if (responseText.Length is < 1 or > 10000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["responseText"] = ["The response can contain at most 10,000 characters."] });
            var value = await db.ExecutionExternalRequests.Include(x => x.Run).ThenInclude(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == requestId && x.Run.ClaimedByPersonId == personId && x.Run.Status == "in_progress", ct);
            if (value is null || !await WorkLevelAuthorization.BelongsToLevel(value.Run.WorkItem.SiteId, value.Run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            value.RecordResponse(responseText, now);
            WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), value.Run.WorkItem.SiteId, personId, "execution.external-response-recorded", "execution-external-request", value.Id, now), "execution.updated", workItemId: value.Run.WorkItemId, resourceType: "execution", resourceId: value.Run.Id, metadataJson: "{\"changedFields\":\"externalFollowUp\"}");
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record ExternalRequest(Guid StepId, string Recipient, string RequestText);
    private sealed record ResponseRequest(string ResponseText);
}
