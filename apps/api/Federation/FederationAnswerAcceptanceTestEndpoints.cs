using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Approvals;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

// Isolated bridge into the ordinary report archive. The accepting actor is
// the origin site's leader, not a platform-wide manager or the remote peer.
internal static class FederationAnswerAcceptanceTestEndpoints
{
    internal static void MapFederationAnswerAcceptanceTestEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/test/sites/{siteId:guid}/items/{itemId:guid}/accept-answer",
                Accept)
            .RequireAuthorization()
            .RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Accept(Guid siteId, Guid itemId, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!WorkItemPolicy.PersonId(user, out var actor)) return Results.Forbid();
        var work = await db.WorkItems.SingleOrDefaultAsync(value =>
            value.Id == itemId && value.SiteId == siteId, ct);
        if (work is null) return Results.NotFound();
        if (!await WorkItemPolicy.CanManageItem(work, actor, db, ct)) return Results.Forbid();
        var link = await db.FederationWorkLinks.AsNoTracking().SingleOrDefaultAsync(value =>
            value.Direction == "outgoing" && value.LocalWorkItemId == itemId &&
            value.OriginSiteId == siteId, ct);
        if (link?.OfficialAnswerMessageId is null || link.OfficialAnswerApprovedAt is null ||
            string.IsNullOrWhiteSpace(link.OfficialAnswerSiteName) ||
            string.IsNullOrWhiteSpace(link.OfficialAnswer) ||
            work.Status is "completed" or "cancelled" || work.FinalReportApprovedAt is not null)
            return Results.Conflict(new { error = "official_answer_not_ready_for_acceptance" });
        var now = DateTimeOffset.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        work.AcceptFederatedOfficialReport(link.OfficialAnswer,
            link.OfficialAnswerClassification, link.OfficialAnswerApprovedAt.Value, actor, now);
        await FormalApprovalService.Approve(db, siteId, "final_report", work.Id, work.Id,
            $"Svar på anmodning: {work.Title}", new
            {
                task = new { work.Id, work.Title, work.Description, work.AssignedUnitId,
                    work.CreatedAt, work.DueAt },
                report = new { content = work.FinalReport,
                    classification = work.FinalReportClassification,
                    sourceInstanceId = link.PeerInstanceId,
                    sourceSiteId = link.RemoteSiteId, sourceSiteName = link.OfficialAnswerSiteName,
                    sourceWorkItemId = link.RemoteWorkItemId,
                    sourceMessageId = link.OfficialAnswerMessageId,
                    remoteApprovedAt = link.OfficialAnswerApprovedAt, acceptedAt = now }
            }, actor, now, ct);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor,
            "work-item.federated-answer-accepted", "work-item", work.Id, now));
        DomainEventRecorder.Record(db, "task.completed", siteId, actor,
            "task", work.Id, new { taskId = work.Id, status = "completed" }, now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.NoContent();
    }
}
