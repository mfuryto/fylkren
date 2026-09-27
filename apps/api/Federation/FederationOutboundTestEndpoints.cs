using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using System.Text.Json;
using System.Text;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

// Synthetic-only producer. Never register this endpoint outside FederationTest.
internal static class FederationOutboundTestEndpoints
{
    private sealed record QueueRequest(Guid SourceSiteId, Guid DestinationSiteId, Guid PeerInstanceId,
        string Title, string Instruction);
    private sealed record AnswerRequest(string OfficialReport);
    private sealed record ProgressRequest(string Phase);
    private sealed record CancellationRequest(string Reason);

    internal static void MapFederationOutboundTestEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/platform/federation/test/outbound", Queue)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"))
            .RequireFeature(FeatureCatalog.InstanceFederation);
        endpoints.MapPost("/api/platform/federation/test/answer/{localWorkItemId:guid}", QueueAnswer)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"))
            .RequireFeature(FeatureCatalog.InstanceFederation);
        endpoints.MapPost("/api/platform/federation/test/progress/{localWorkItemId:guid}", QueueProgress)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"))
            .RequireFeature(FeatureCatalog.InstanceFederation);
        endpoints.MapPost("/api/platform/federation/test/cancel/{localWorkItemId:guid}", QueueCancellation)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"))
            .RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> QueueCancellation(Guid localWorkItemId, CancellationRequest request,
        ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor))
            return Results.Forbid();
        var reason = request.Reason?.Trim();
        if (reason is null || reason.Length is < 2 or > 2000)
            return Results.BadRequest(new { error = "invalid_cancellation_reason" });
        var link = await db.FederationWorkLinks.AsNoTracking().SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == localWorkItemId && value.Direction == "outgoing", ct);
        var work = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(value =>
            value.Id == localWorkItemId, ct);
        if (link?.RemoteWorkItemId is null || work is null ||
            work.SiteId != link.OriginSiteId || work.Status is "completed" or "cancelled" ||
            link.OfficialAnswerMessageId is not null ||
            await db.FederationOutboundMessages.AsNoTracking().AnyAsync(value =>
                value.MessageType == "assignment.cancelled" &&
                value.OriginResourceId == localWorkItemId && value.PeerInstanceId == link.PeerInstanceId, ct))
            return Results.Conflict(new { error = "cancellation_not_available" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        if (link.OriginInstanceId != localId || !await db.FederationPeers.AsNoTracking().AnyAsync(peer =>
                peer.InstanceId == link.PeerInstanceId && peer.IsActive &&
                peer.PinnedPublicKeySpki != null && peer.LastProofAt != null, ct))
            return Results.Conflict(new { error = "cancellation_peer_not_authorized" });
        var original = await db.FederationOutboundMessages.AsNoTracking().SingleOrDefaultAsync(value =>
            value.MessageType == "assignment.created" && value.Status == "delivered" &&
            value.OriginResourceId == localWorkItemId && value.PeerInstanceId == link.PeerInstanceId, ct);
        if (original is null) return Results.Conflict(new { error = "origin_message_not_confirmed" });
        var now = DateTimeOffset.UtcNow;
        var payload = JsonSerializer.Serialize(new FederationCancellationPayload(reason),
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var message = new FederationOutboundMessage(Guid.NewGuid(), link.PeerInstanceId,
            work.SiteId, link.RemoteSiteId, localId, work.SiteId, work.Id,
            "assignment.cancelled", FederationWorkProtocol.SchemaVersion, payload, now,
            original.MessageId, original.MessageId);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        db.FederationOutboundMessages.Add(message);
        var audit = new AuditEvent(Guid.NewGuid(), work.SiteId, actor,
            "federation-test.cancellation-queued", "work-item", work.Id, now);
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Accepted(value: new { workItemId = work.Id, messageId = message.MessageId });
    }

    private static async Task<IResult> QueueProgress(Guid localWorkItemId, ProgressRequest request,
        ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor))
            return Results.Forbid();
        if (request.Phase is not ("under_review" or "assigned" or "in_progress"))
            return Results.BadRequest(new { error = "invalid_progress_phase" });
        var link = await db.FederationWorkLinks.SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == localWorkItemId && value.Direction == "incoming", ct);
        var work = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(value =>
            value.Id == localWorkItemId, ct);
        if (link is null || work is null || work.AssignedUnitId is not null ||
            work.Status == "completed" || work.FinalReportApprovedAt is not null)
            return Results.Conflict(new { error = "progress_not_available" });
        var original = await db.FederationInboundReceipts.AsNoTracking().SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == localWorkItemId && value.PeerInstanceId == link.PeerInstanceId &&
            value.MessageType == "assignment.created", ct);
        if (original is null) return Results.Conflict(new { error = "origin_message_not_confirmed" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        if (!await FederationOutboundDeliveryWorker.ProgressAuthorizedAsync(link, work, localId, db, ct))
            return Results.Conflict(new { error = "progress_peer_not_authorized" });
        var now = DateTimeOffset.UtcNow;
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var sequence = link.EmitProgress(request.Phase, now);
        var payload = JsonSerializer.Serialize(new FederationProgressPayload(request.Phase, sequence),
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var message = new FederationOutboundMessage(Guid.NewGuid(), link.PeerInstanceId,
            work.SiteId, link.OriginSiteId, link.OriginInstanceId, link.OriginSiteId,
            link.OriginResourceId, "assignment.progress", FederationWorkProtocol.SchemaVersion,
            payload, now, original.MessageId, original.MessageId);
        db.FederationOutboundMessages.Add(message);
        var audit = new AuditEvent(Guid.NewGuid(), work.SiteId, actor,
            "federation-test.progress-queued", "work-item", work.Id, now);
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Accepted(value: new { workItemId = work.Id, messageId = message.MessageId, sequence });
    }

    private static async Task<IResult> Queue(QueueRequest request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor))
            return Results.Forbid();
        if (request.Title is null or { Length: < 2 or > 200 } ||
            request.Instruction is null or { Length: < 1 or > 10_000 })
            return Results.BadRequest(new { error = "invalid_test_assignment" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var work = new WorkItem(Guid.NewGuid(), request.SourceSiteId, actor,
            request.Title, request.Instruction, null, "normal", null, now);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var outbound = await FederationOutboundWorkQueue.EnqueueAssignmentAsync(work,
            request.PeerInstanceId, request.DestinationSiteId, localId, db, ct);
        if (outbound is null) return Results.Conflict(new { error = "federation_outbound_not_authorized" });
        db.WorkItems.Add(work);
        var audit = new AuditEvent(Guid.NewGuid(), request.SourceSiteId, actor,
            "federation-test.assignment-queued", "work-item", work.Id, now);
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
        DomainEventRecorder.Record(db, "assignment.created", work.SiteId,
            actor, "task", work.Id, new { taskId = work.Id, status = work.Status }, now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Accepted(value: new { workItemId = work.Id, messageId = outbound.MessageId });
    }

    private static async Task<IResult> QueueAnswer(Guid localWorkItemId, AnswerRequest request,
        ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor))
            return Results.Forbid();
        if (string.IsNullOrWhiteSpace(request.OfficialReport) || request.OfficialReport.Length > 20_000)
            return Results.BadRequest(new { error = "invalid_official_report" });
        var link = await db.FederationWorkLinks.SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == localWorkItemId && value.Direction == "incoming", ct);
        var work = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == localWorkItemId, ct);
        if (link is null || work is null ||
            work.AssignedUnitId is not null || work.FinalReportApprovedAt is not null)
            return Results.Conflict(new { error = "official_answer_not_available" });
        var originalReceipt = await db.FederationInboundReceipts.AsNoTracking()
            .SingleOrDefaultAsync(value => value.LocalWorkItemId == localWorkItemId &&
                value.PeerInstanceId == link.PeerInstanceId &&
                value.MessageType == "assignment.created", ct);
        if (originalReceipt is null)
            return Results.Conflict(new { error = "origin_message_not_confirmed" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var report = request.OfficialReport.Trim();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        work.UpdateFinalReport(report, null, actor, now);
        work.ApproveFinalReport(actor, now);
        work.TransitionWithinLevel("completed", null, now);
        if (!await FederationOutboundDeliveryWorker.AnswerAuthorizedAsync(link, work, localId, db, ct))
            return Results.Conflict(new { error = "answer_peer_not_authorized" });
        var payload = JsonSerializer.Serialize(new FederationOfficialAnswerPayload(report, null, now),
            new JsonSerializerOptions(JsonSerializerDefaults.Web));
        if (Encoding.UTF8.GetByteCount(payload) > 100_000)
            return Results.BadRequest(new { error = "official_report_too_large_for_transport" });
        var message = new FederationOutboundMessage(Guid.NewGuid(), link.PeerInstanceId,
            work.SiteId, link.OriginSiteId, link.OriginInstanceId, link.OriginSiteId,
            link.OriginResourceId, "assignment.answered", FederationWorkProtocol.SchemaVersion,
            payload, now, originalReceipt.MessageId, originalReceipt.MessageId);
        db.FederationOutboundMessages.Add(message);
        var audit = new AuditEvent(Guid.NewGuid(), work.SiteId, actor,
            "federation-test.official-answer-queued", "work-item", work.Id, now);
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
        DomainEventRecorder.Record(db, "task.completed", work.SiteId, actor,
            "task", work.Id, new { taskId = work.Id, status = "completed" }, now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Accepted(value: new { workItemId = work.Id, messageId = message.MessageId });
    }
}
