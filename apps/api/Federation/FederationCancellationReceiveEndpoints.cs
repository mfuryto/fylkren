using System.Security.Cryptography;
using System.Text;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fylkren.Api.Federation;

// Test-only: notify the already acknowledged receiving task; its local leader
// remains responsible for acknowledging and closing it.
internal static class FederationCancellationReceiveEndpoints
{
    internal static void MapFederationCancellationReceiveEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/cancel", Receive)
            .AllowAnonymous().RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation)
            .WithMetadata(new RequestSizeLimitAttribute(16_384));
    }

    private static async Task<IResult> Receive(FederationWorkEnvelope request, HttpContext context,
        IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await FederationRoutingPolicy.IsEnabledAsync(db, ct)) return Results.NotFound();
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS is required.");
        var now = DateTimeOffset.UtcNow;
        var seconds = now.ToUnixTimeSeconds();
        if (!FederationCancellationContract.TryDecode(request, out var cancellation) ||
            request.Timestamp < seconds - 300 || request.Timestamp > seconds + 300)
            return Results.BadRequest(new { error = "invalid_cancellation" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(value =>
            value.InstanceId == request.SenderInstanceId && value.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null || peer.LastProofAt is null ||
            !FederationSignatureProtocol.Accepts(peer.SignatureAlgorithm, request.SignatureAlgorithm) ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _) ||
            !FederationProbeProtocol.Verify(peerKey, FederationWorkProtocol.SignedBytes(request), request.Signature))
            return Results.Unauthorized();
        var sourceName = await db.FederationRemoteSites.AsNoTracking()
            .Where(value => value.InstanceId == peer.InstanceId && value.SiteId == request.SourceSiteId)
            .Select(value => value.Name).SingleOrDefaultAsync(ct);
        if (sourceName is null) return Results.StatusCode(403);
        var identity = await db.FederationSigningIdentities.AsNoTracking()
            .SingleOrDefaultAsync(value => value.Key == 1, ct);
        if (identity is null) return Results.Problem(statusCode: 503, title: "The federation key is missing.");
        ECDsa localKey;
        try { localKey = FederationSigningKeys.Load(identity, protection); }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "The federation key cannot be used.");
        }
        using (localKey)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            if (await db.FederationProbeNonces.AsNoTracking().AnyAsync(value =>
                value.PeerInstanceId == peer.InstanceId && value.Nonce == request.Nonce, ct))
                return Results.Conflict(new { error = "replayed_cancellation" });
            var link = await db.FederationWorkLinks.SingleOrDefaultAsync(value =>
                value.Direction == "incoming" && value.LocalWorkItemId == request.CounterpartWorkItemId &&
                value.PeerInstanceId == peer.InstanceId && value.RemoteSiteId == request.SourceSiteId &&
                value.OriginInstanceId == peer.InstanceId && value.OriginSiteId == request.SourceSiteId &&
                value.OriginResourceId == request.OriginResourceId, ct);
            if (link is null) return Results.StatusCode(403);
            var work = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(value =>
                value.Id == link.LocalWorkItemId && value.SiteId == request.DestinationSiteId, ct);
            if (work is null) return Results.StatusCode(403);
            var originalReceived = await db.FederationInboundReceipts.AsNoTracking().AnyAsync(value =>
                value.MessageId == request.CorrelationId && value.MessageId == request.CausationId &&
                value.MessageType == "assignment.created" && value.PeerInstanceId == peer.InstanceId &&
                value.SourceSiteId == request.SourceSiteId &&
                value.DestinationSiteId == request.DestinationSiteId &&
                value.OriginResourceId == request.OriginResourceId &&
                value.LocalWorkItemId == work.Id, ct);
            if (!originalReceived) return Results.StatusCode(403);
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.PayloadJson)));
            var previous = await db.FederationInboundReceipts.AsNoTracking().SingleOrDefaultAsync(value =>
                value.PeerInstanceId == peer.InstanceId && value.MessageId == request.MessageId, ct);
            if (previous is not null &&
                (previous.MessageType != request.MessageType || previous.SourceSiteId != request.SourceSiteId ||
                 previous.DestinationSiteId != request.DestinationSiteId ||
                 previous.OriginInstanceId != request.OriginInstanceId ||
                 previous.OriginSiteId != request.OriginSiteId ||
                 previous.OriginResourceId != request.OriginResourceId ||
                 previous.CorrelationId != request.CorrelationId ||
                 previous.CausationId != request.CausationId ||
                 previous.PayloadSha256 != hash || previous.LocalWorkItemId != work.Id))
                return Results.Conflict(new { error = "cancellation_message_identity_conflict" });
            if (previous is null)
            {
                if (work.Status is "completed" or "rejected" or "cancelled" or "request_cancelled" ||
                    work.FinalReportApprovedAt is not null)
                    return Results.Conflict(new { error = "receiver_work_already_closed" });
                // The conditional UPDATE serializes cancellation against a
                // concurrent final report/closure without overwriting it.
                await db.Database.ExecuteSqlRawAsync("SELECT set_config('fylkren.activity_writer', '1', true)", ct);
                var changed = await db.WorkItems.Where(value => value.Id == work.Id &&
                        value.SiteId == request.DestinationSiteId &&
                        value.Status != "completed" && value.Status != "rejected" &&
                        value.Status != "cancelled" && value.Status != "request_cancelled" &&
                        value.FinalReportApprovedAt == null)
                    .ExecuteUpdateAsync(setters => setters
                        .SetProperty(value => value.Status, "request_cancelled")
                        .SetProperty(value => value.DecisionNote, cancellation!.Reason.Trim())
                        .SetProperty(value => value.UpdatedAt, now), ct);
                if (changed != 1)
                    return Results.Conflict(new { error = "receiver_work_already_closed" });
                db.FederationInboundReceipts.Add(new FederationInboundReceipt(peer.InstanceId,
                    request.MessageId, request.MessageType, request.SourceSiteId,
                    request.DestinationSiteId, request.OriginInstanceId, request.OriginSiteId,
                    request.OriginResourceId, request.CorrelationId, request.CausationId,
                    hash, work.Id, now));
                Fylkren.Api.DomainEvents.WorkActivity.Add(db, AuditEvent.FromFederatedPeer(Guid.NewGuid(),
                    request.DestinationSiteId, peer.InstanceId, request.SourceSiteId, sourceName,
                    "work-item.request-cancelled-by-sender", "work-item", work.Id, now), "assignment.cancelled", "work-item-changed", sourceMessageId: request.MessageId, correlationId: request.CorrelationId);
            }
            db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
            try
            {
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
            }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                await transaction.RollbackAsync(ct);
                return Results.Conflict(new { error = "concurrent_cancellation_retry" });
            }
            var receipt = new FederationWorkReceipt(FederationWorkProtocol.SchemaVersion,
                localId, peer.InstanceId, request.MessageId, request.Nonce, request.SourceSiteId,
                request.DestinationSiteId, work.Id, hash, 0,
                previous is not null, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), string.Empty, request.SignatureAlgorithm);
            return Results.Ok(receipt with
            {
                Signature = FederationProbeProtocol.Sign(localKey,
                    FederationWorkReceiptProtocol.SignedBytes(receipt))
            });
        }
    }
}
