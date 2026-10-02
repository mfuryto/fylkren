using System.Text.Json;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

// Adds the outbox row to the caller's DbContext. The caller must commit this
// together with its originating work action; this method never sends HTTP.
internal static class FederationOutboundWorkQueue
{
    internal static async Task<FederationOutboundMessage?> EnqueueAssignmentAsync(
        WorkItem work, Guid peerInstanceId, Guid destinationSiteId, Guid localInstanceId,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (work.SiteId == Guid.Empty || work.Id == Guid.Empty ||
            peerInstanceId == Guid.Empty || destinationSiteId == Guid.Empty ||
            localInstanceId == Guid.Empty || peerInstanceId == localInstanceId)
            return null;
        if (!await AuthorizedAsync(work.SiteId, peerInstanceId, destinationSiteId, db, ct)) return null;
        await db.AssignPendingWorkItemReferencesAsync(ct);

        var payload = new FederationAssignmentPayload("request", work.Title, work.Description,
            work.Priority, work.DueAt, work.RequestBasisSnapshot,
            work.SourceTypeNameSnapshot, work.SenderNameSnapshot,
            string.IsNullOrWhiteSpace(work.ReferenceCode) ? null : work.ReferenceCode);
        var json = JsonSerializer.Serialize(payload, new JsonSerializerOptions(JsonSerializerDefaults.Web));
        var messageId = Guid.NewGuid();
        var envelope = new FederationWorkEnvelope(FederationWorkProtocol.SchemaVersion,
            messageId, "assignment.created", localInstanceId, peerInstanceId,
            work.SiteId, destinationSiteId, localInstanceId, work.SiteId, work.Id,
            null, null, null, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), Guid.NewGuid(), json, null);
        if (!FederationAssignmentContract.TryDecode(envelope, out _)) return null;
        var now = DateTimeOffset.UtcNow;
        var message = new FederationOutboundMessage(messageId, peerInstanceId, work.SiteId,
            destinationSiteId, localInstanceId, work.SiteId, work.Id,
            "assignment.created", FederationWorkProtocol.SchemaVersion, json, now);
        db.FederationOutboundMessages.Add(message);
        db.FederationWorkLinks.Add(new FederationWorkLink(Guid.NewGuid(), work.Id, peerInstanceId,
            destinationSiteId, localInstanceId, work.SiteId, work.Id, "outgoing", now));
        return message;
    }

    internal static async Task<bool> AuthorizedAsync(Guid sourceSiteId, Guid peerInstanceId,
        Guid destinationSiteId, FylkrenDbContext db, CancellationToken ct)
    {
        var sourceReady = await db.Sites.AsNoTracking().AnyAsync(site =>
            site.Id == sourceSiteId && site.IsActive && site.ParentOrganizationUnitId == null, ct);
        var peerReady = await db.FederationPeers.AsNoTracking().AnyAsync(peer =>
            peer.InstanceId == peerInstanceId && peer.IsActive && peer.LastProofAt != null &&
            peer.PinnedPublicKeySpki != null, ct);
        var destinationReady = await db.FederationRemoteSites.AsNoTracking().AnyAsync(value =>
            value.InstanceId == peerInstanceId && value.SiteId == destinationSiteId && value.IsActive, ct);
        return sourceReady && peerReady && destinationReady;
    }
}
