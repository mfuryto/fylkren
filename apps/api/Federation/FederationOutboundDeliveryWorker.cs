using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

// Always registered so a Platform Manager can enable routing without restarting the server.
internal sealed class FederationOutboundDeliveryWorker(
    IServiceScopeFactory scopes, IHttpClientFactory clients,
    IDataProtectionProvider protection, ILogger<FederationOutboundDeliveryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                var license = scope.ServiceProvider.GetRequiredService<LicenseService>();
                if (await FederationRoutingPolicy.IsEnabledAsync(db, ct) &&
                    await license.Has(db, FeatureCatalog.InstanceFederation, ct))
                    await DeliverOneAsync(db, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Federation outbox processing failed."); }
            await Task.Delay(TimeSpan.FromSeconds(2), ct);
        }
    }

    private async Task DeliverOneAsync(FylkrenDbContext db, CancellationToken ct)
    {
        if (!await FederationRoutingPolicy.IsEnabledAsync(db, ct)) return;
        // During phase two some peers may already trust the new key while others still
        // trust the old one. Keep work queued until every active peer has acknowledged it.
        if (await db.FederationSigningIdentities.AsNoTracking()
            .AnyAsync(row => row.Key == 1 && row.ActiveRotationId != null, ct)) return;
        var now = DateTimeOffset.UtcNow;
        var id = await db.FederationOutboundMessages.AsNoTracking()
            .Where(row => row.AttemptCount >= 0 && row.AttemptCount < 6 &&
                (row.Status == "pending" || row.Status == "retrying") &&
                row.NextAttemptAt <= now)
            .OrderBy(row => row.NextAttemptAt).ThenBy(row => row.MessageId)
            .Select(row => (Guid?)row.MessageId).FirstOrDefaultAsync(ct);
        if (id is null) return;
        // A future NextAttemptAt is a bounded lease. The conditional UPDATE is
        // the cross-replica claim; a crash leaves the row retryable after 60 s.
        var claimed = await DeliveryClaims.Federation(db, id.Value, now, ct);
        if (claimed != 1) return;
        var message = await db.FederationOutboundMessages.SingleAsync(row => row.MessageId == id, ct);
        string? error = null;
        FederationWorkReceipt? receipt = null;
        try
        {
            var returnMessage = message.MessageType is "assignment.answered" or "assignment.progress";
            var answerLink = returnMessage
                ? await db.FederationWorkLinks.AsNoTracking().SingleOrDefaultAsync(row =>
                    row.Direction == "incoming" && row.PeerInstanceId == message.PeerInstanceId &&
                    row.OriginInstanceId == message.OriginInstanceId &&
                    row.OriginSiteId == message.OriginSiteId &&
                    row.OriginResourceId == message.OriginResourceId &&
                    row.RemoteSiteId == message.DestinationSiteId, ct)
                : null;
            var answerWork = answerLink is null ? null : await db.WorkItems.AsNoTracking()
                .SingleOrDefaultAsync(row => row.Id == answerLink.LocalWorkItemId, ct);
            var cancellationLink = message.MessageType == "assignment.cancelled"
                ? await db.FederationWorkLinks.AsNoTracking().SingleOrDefaultAsync(row =>
                    row.Direction == "outgoing" && row.LocalWorkItemId == message.OriginResourceId &&
                    row.PeerInstanceId == message.PeerInstanceId &&
                    row.RemoteSiteId == message.DestinationSiteId, ct)
                : null;
            var cancellationWork = cancellationLink is null ? null : await db.WorkItems.AsNoTracking()
                .SingleOrDefaultAsync(row => row.Id == cancellationLink.LocalWorkItemId, ct);
            var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
                .Select(row => row.InstanceId).SingleAsync(ct);
            var authorized = message.MessageType == "assignment.cancelled"
                ? cancellationLink?.RemoteWorkItemId is not null && cancellationWork is not null &&
                  cancellationWork.SiteId == message.SourceSiteId &&
                  cancellationLink.OriginInstanceId == localId &&
                  cancellationLink.OfficialAnswerMessageId is null &&
                  cancellationWork.Status != "completed" &&
                  (cancellationWork.Status != "cancelled" || message.DeliveredAt is not null) &&
                  await db.FederationPeers.AsNoTracking().AnyAsync(peer =>
                      peer.InstanceId == message.PeerInstanceId && peer.IsActive &&
                      peer.PinnedPublicKeySpki != null && peer.LastProofAt != null, ct)
                : returnMessage
                ? answerLink is not null && answerWork is not null &&
                  answerWork.SiteId == message.SourceSiteId &&
                  (message.MessageType == "assignment.answered"
                    ? await AnswerAuthorizedAsync(answerLink, answerWork, localId, db, ct)
                    : await ProgressAuthorizedAsync(answerLink, answerWork, localId, db, ct))
                : await FederationOutboundWorkQueue.AuthorizedAsync(message.SourceSiteId,
                    message.PeerInstanceId, message.DestinationSiteId, db, ct);
            if (!authorized)
                error = "outbound_not_authorized";
            else
            {
                var peer = await db.FederationPeers.AsNoTracking().SingleAsync(row =>
                    row.InstanceId == message.PeerInstanceId, ct);
                var identity = await db.FederationSigningIdentities.AsNoTracking()
                    .SingleOrDefaultAsync(row => row.Key == 1, ct);
                if (identity is null || peer.PinnedPublicKeySpki is null ||
                    !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _))
                    error = "identity_unavailable";
                else
                {
                    using var localKey = FederationSigningKeys.Load(identity, protection);
                    error = await FederationCapabilityClient.Negotiate(localId, peer,
                        localKey, peerKey, message.MessageType, clients, ct);
                    if (error is null)
                    {
                        var nonce = Guid.NewGuid();
                        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                        var envelope = new FederationWorkEnvelope(message.SchemaVersion,
                            message.MessageId, message.MessageType, localId,
                            message.PeerInstanceId, message.SourceSiteId, message.DestinationSiteId,
                            message.OriginInstanceId, message.OriginSiteId, message.OriginResourceId,
                            answerLink?.LocalWorkItemId ?? cancellationLink?.RemoteWorkItemId,
                            message.CorrelationId, message.CausationId, timestamp, nonce,
                            message.PayloadJson, null);
                        var validPayload = message.MessageType switch
                        {
                            "assignment.answered" => FederationOfficialAnswerContract.TryDecode(envelope, out _),
                            "assignment.progress" => FederationProgressContract.TryDecode(envelope, out _),
                            "assignment.cancelled" => FederationCancellationContract.TryDecode(envelope, out _),
                            _ => FederationAssignmentContract.TryDecode(envelope, out _)
                        };
                        if (!validPayload)
                            error = "invalid_outbound_payload";
                        else
                        {
                            envelope = envelope with
                            {
                                Signature = FederationProbeProtocol.Sign(localKey,
                                    FederationWorkProtocol.SignedBytes(envelope))
                            };
                            var path = message.MessageType switch
                            {
                                "assignment.answered" => "api/federation/v1/answer",
                                "assignment.progress" => "api/federation/v1/progress",
                                "assignment.cancelled" => "api/federation/v1/cancel",
                                _ => "api/federation/v1/work"
                            };
                            var target = new Uri(new Uri(peer.BaseUrl + "/"), path);
                            using var outgoing = new HttpRequestMessage(HttpMethod.Post, target)
                            {
                                Content = JsonContent.Create(envelope)
                            };
                            using var response = await clients.CreateClient("federation-probe")
                                .SendAsync(outgoing, HttpCompletionOption.ResponseHeadersRead, ct);
                            if (!response.IsSuccessStatusCode)
                                error = response.StatusCode is System.Net.HttpStatusCode.Forbidden
                                    ? "remote_grant_denied" : "remote_http_error";
                            else
                            {
                                await response.Content.LoadIntoBufferAsync(16_384, ct);
                                receipt = await response.Content.ReadFromJsonAsync<FederationWorkReceipt>(cancellationToken: ct);
                                var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(message.PayloadJson)));
                                var current = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                                if (receipt is null || receipt.SchemaVersion != FederationWorkProtocol.SchemaVersion ||
                                    receipt.SenderInstanceId != peer.InstanceId ||
                                    receipt.RecipientInstanceId != localId ||
                                    receipt.MessageId != message.MessageId || receipt.Nonce != nonce ||
                                    receipt.SourceSiteId != message.SourceSiteId ||
                                    receipt.DestinationSiteId != message.DestinationSiteId ||
                                    receipt.LocalWorkItemId == Guid.Empty || receipt.PayloadSha256 != hash ||
                                    (message.MessageType == "assignment.cancelled"
                                        ? receipt.LocalWorkItemId != cancellationLink!.RemoteWorkItemId || receipt.GrantRevision != 0
                                        : returnMessage
                                        ? receipt.LocalWorkItemId != message.OriginResourceId || receipt.GrantRevision != 0
                                        : receipt.GrantRevision < 1) ||
                                    receipt.Timestamp < current - 300 ||
                                    receipt.Timestamp > current + 300 ||
                                    !FederationProbeProtocol.Verify(peerKey,
                                        FederationWorkReceiptProtocol.SignedBytes(receipt), receipt.Signature))
                                {
                                    receipt = null;
                                    error = "invalid_signed_receipt";
                                }
                            }
                        }
                    }
                }
            }
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
            System.Text.Json.JsonException or CryptographicException or InvalidOperationException)
        {
            error = "delivery_exception";
            logger.LogWarning(ex, "Federation delivery attempt failed for message {MessageId}.", message.MessageId);
        }

        if (receipt is not null)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            if (message.MessageType == "assignment.created")
            {
                var link = await db.FederationWorkLinks.SingleAsync(row =>
                    row.Direction == "outgoing" && row.LocalWorkItemId == message.OriginResourceId &&
                    row.PeerInstanceId == message.PeerInstanceId &&
                    row.RemoteSiteId == message.DestinationSiteId, ct);
                var alreadyAcknowledged = link.AcknowledgedAt is not null;
                link.Acknowledge(receipt.LocalWorkItemId, DateTimeOffset.UtcNow);
                if (!alreadyAcknowledged) Fylkren.Api.DomainEvents.WorkActivity.Add(db,
                    ActivityAudit.AuditEvent.FromSystem(Guid.NewGuid(), "federation-delivery", "assignment.sent", "work-item", message.OriginResourceId, DateTimeOffset.UtcNow),
                    "assignment.sent", workItemId: message.OriginResourceId, sourceMessageId: message.MessageId, correlationId: message.CorrelationId);
            }
            if (message.MessageType == "assignment.cancelled")
            {
                var work = await db.WorkItems.SingleAsync(row =>
                    row.Id == message.OriginResourceId && row.SiteId == message.SourceSiteId, ct);
                var cancellation = System.Text.Json.JsonSerializer.Deserialize<FederationCancellationPayload>(
                    message.PayloadJson, new System.Text.Json.JsonSerializerOptions(
                        System.Text.Json.JsonSerializerDefaults.Web))!;
                if (work.Status != "cancelled")
                {
                    work.TransitionWithinLevel("cancelled", cancellation.Reason.Trim(), DateTimeOffset.UtcNow);
                    var peerName = await db.FederationRemoteSites.AsNoTracking()
                        .Where(row => row.InstanceId == message.PeerInstanceId &&
                            row.SiteId == message.DestinationSiteId)
                        .Select(row => row.Name).SingleAsync(ct);
                    Fylkren.Api.DomainEvents.WorkActivity.Add(db, ActivityAudit.AuditEvent.FromFederatedPeer(Guid.NewGuid(),
                        message.SourceSiteId, message.PeerInstanceId, message.DestinationSiteId,
                        peerName, "work-item.cancellation-acknowledged-by-peer", "work-item",
                        work.Id, DateTimeOffset.UtcNow), "assignment.cancelled", sourceMessageId: message.MessageId, correlationId: message.CorrelationId);
                }
            }
            message.MarkDelivered(DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
        else
        {
            var reason = error ?? "unknown_delivery_error";
            if (message.AttemptCount >= 6) message.MarkFailed(reason);
            else
            {
                var minutes = new[] { 1, 2, 5, 15, 30 };
                message.RecordRetry(reason, DateTimeOffset.UtcNow.AddMinutes(
                    minutes[Math.Min(message.AttemptCount - 1, minutes.Length - 1)]));
            }
            await db.SaveChangesAsync(ct);
        }
    }

    internal static async Task<bool> AnswerAuthorizedAsync(FederationWorkLink link,
        WorkManagement.WorkItem work, Guid localInstanceId, FylkrenDbContext db, CancellationToken ct)
    {
        if (link.Direction != "incoming" || link.OriginInstanceId != link.PeerInstanceId ||
            link.OriginInstanceId == localInstanceId || link.LocalWorkItemId != work.Id ||
            work.AssignedUnitId is not null || work.Status != "completed" ||
            string.IsNullOrWhiteSpace(work.FinalReport) || work.FinalReportApprovedAt is null ||
            work.FinalReportApprovedByPersonId is null)
            return false;
        return await db.FederationPeers.AsNoTracking().AnyAsync(peer =>
            peer.InstanceId == link.PeerInstanceId && peer.IsActive &&
            peer.PinnedPublicKeySpki != null && peer.LastProofAt != null, ct);
    }

    internal static async Task<bool> ProgressAuthorizedAsync(FederationWorkLink link,
        WorkManagement.WorkItem work, Guid localInstanceId, FylkrenDbContext db, CancellationToken ct)
    {
        if (link.Direction != "incoming" || link.OriginInstanceId != link.PeerInstanceId ||
            link.OriginInstanceId == localInstanceId || link.LocalWorkItemId != work.Id ||
            work.AssignedUnitId is not null || work.Status == "completed" ||
            work.FinalReportApprovedAt is not null)
            return false;
        return await db.FederationPeers.AsNoTracking().AnyAsync(peer =>
            peer.InstanceId == link.PeerInstanceId && peer.IsActive &&
            peer.PinnedPublicKeySpki != null && peer.LastProofAt != null, ct);
    }
}
