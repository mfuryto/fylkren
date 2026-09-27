using System.Text;
using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

// Adds return messages to the durable outbox inside the same SaveChanges as
// the ordinary work-item command. Delivery remains the worker's responsibility.
internal static class FederationOperationalReturnQueue
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    internal static async Task<string?> QueueProgressIfFederatedAsync(WorkItem work, Guid actor,
        DateTimeOffset now, FylkrenDbContext db, CancellationToken ct)
    {
        var phase = work.Status switch
        {
            "under_review" => "under_review",
            "assigned" => "assigned",
            "planning" or "planning_approval" or "planning_approved" or "execution" or
                "in_progress" or "in_review" => "in_progress",
            _ => null
        };
        if (phase is null) return null;

        var link = await db.FederationWorkLinks.SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == work.Id && value.Direction == "incoming", ct);
        if (link is null || link.RemoteProgressStatus == phase) return null;
        var original = await db.FederationInboundReceipts.AsNoTracking().SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == work.Id && value.PeerInstanceId == link.PeerInstanceId &&
            value.MessageType == "assignment.created", ct);
        if (original is null) return "origin_message_not_confirmed";
        var localId = await LocalInstanceId(db, ct);
        if (!await FederationOutboundDeliveryWorker.ProgressAuthorizedAsync(link, work, localId, db, ct))
            return "progress_peer_not_authorized";

        var sequence = link.EmitProgress(phase, now);
        var payload = JsonSerializer.Serialize(new FederationProgressPayload(phase, sequence), Json);
        db.FederationOutboundMessages.Add(new FederationOutboundMessage(Guid.NewGuid(),
            link.PeerInstanceId, work.SiteId, link.OriginSiteId, link.OriginInstanceId,
            link.OriginSiteId, link.OriginResourceId, "assignment.progress",
            FederationWorkProtocol.SchemaVersion, payload, now, original.MessageId,
            original.MessageId));
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), work.SiteId, actor,
            "work-item.federated-progress-queued", "work-item", work.Id, now));
        return null;
    }

    internal static async Task<string?> QueueAnswerIfFederatedAsync(WorkItem work, Guid actor,
        DateTimeOffset now, FylkrenDbContext db, CancellationToken ct)
    {
        var link = await db.FederationWorkLinks.SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == work.Id && value.Direction == "incoming", ct);
        if (link is null) return null;
        var original = await db.FederationInboundReceipts.AsNoTracking().SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == work.Id && value.PeerInstanceId == link.PeerInstanceId &&
            value.MessageType == "assignment.created", ct);
        if (original is null) return "origin_message_not_confirmed";
        if (await db.FederationOutboundMessages.AsNoTracking().AnyAsync(value =>
                value.MessageType == "assignment.answered" &&
                value.OriginResourceId == link.OriginResourceId &&
                value.PeerInstanceId == link.PeerInstanceId, ct))
            return "official_answer_already_queued";
        var localId = await LocalInstanceId(db, ct);
        if (!await FederationOutboundDeliveryWorker.AnswerAuthorizedAsync(link, work, localId, db, ct))
            return "answer_peer_not_authorized";

        var payload = JsonSerializer.Serialize(new FederationOfficialAnswerPayload(
            work.FinalReport!, work.FinalReportClassification,
            work.FinalReportApprovedAt!.Value), Json);
        if (Encoding.UTF8.GetByteCount(payload) > 100_000)
            return "official_report_too_large_for_transport";
        db.FederationOutboundMessages.Add(new FederationOutboundMessage(Guid.NewGuid(),
            link.PeerInstanceId, work.SiteId, link.OriginSiteId, link.OriginInstanceId,
            link.OriginSiteId, link.OriginResourceId, "assignment.answered",
            FederationWorkProtocol.SchemaVersion, payload, now, original.MessageId,
            original.MessageId));
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), work.SiteId, actor,
            "work-item.federated-answer-queued", "work-item", work.Id, now));
        return null;
    }

    internal static async Task<(bool Handled, string? Error)> QueueCancellationIfFederatedAsync(
        WorkItem work, Guid actor, string reason, DateTimeOffset now, FylkrenDbContext db,
        CancellationToken ct)
    {
        var link = await db.FederationWorkLinks.AsNoTracking().SingleOrDefaultAsync(value =>
            value.LocalWorkItemId == work.Id && value.Direction == "outgoing", ct);
        if (link is null) return (false, null);
        if (link.RemoteWorkItemId is null || work.SiteId != link.OriginSiteId ||
            work.Status is "completed" or "cancelled" || link.OfficialAnswerMessageId is not null ||
            await db.FederationOutboundMessages.AsNoTracking().AnyAsync(value =>
                value.MessageType == "assignment.cancelled" &&
                value.OriginResourceId == work.Id && value.PeerInstanceId == link.PeerInstanceId, ct))
            return (true, "cancellation_not_available");
        var localId = await LocalInstanceId(db, ct);
        if (link.OriginInstanceId != localId || !await db.FederationPeers.AsNoTracking().AnyAsync(peer =>
                peer.InstanceId == link.PeerInstanceId && peer.IsActive &&
                peer.PinnedPublicKeySpki != null && peer.LastProofAt != null, ct))
            return (true, "cancellation_peer_not_authorized");
        var original = await db.FederationOutboundMessages.AsNoTracking().SingleOrDefaultAsync(value =>
            value.MessageType == "assignment.created" && value.Status == "delivered" &&
            value.OriginResourceId == work.Id && value.PeerInstanceId == link.PeerInstanceId, ct);
        if (original is null) return (true, "origin_message_not_confirmed");

        var payload = JsonSerializer.Serialize(new FederationCancellationPayload(reason), Json);
        db.FederationOutboundMessages.Add(new FederationOutboundMessage(Guid.NewGuid(),
            link.PeerInstanceId, work.SiteId, link.RemoteSiteId, localId, work.SiteId, work.Id,
            "assignment.cancelled", FederationWorkProtocol.SchemaVersion, payload, now,
            original.MessageId, original.MessageId));
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), work.SiteId, actor,
            "work-item.federated-cancellation-queued", "work-item", work.Id, now));
        return (true, null);
    }

    private static Task<Guid> LocalInstanceId(FylkrenDbContext db, CancellationToken ct) =>
        db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
}
