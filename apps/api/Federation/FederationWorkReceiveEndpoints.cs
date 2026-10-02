using System.Security.Cryptography;
using System.Text;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fylkren.Api.Federation;

// Always mapped, but returns 404 until a Platform Manager enables production routing.
internal static class FederationWorkReceiveEndpoints
{
    internal static void MapFederationWorkReceiveEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/work", Receive)
            .AllowAnonymous()
            .RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation)
            .WithMetadata(new RequestSizeLimitAttribute(300_000));
    }

    private static async Task<IResult> Receive(FederationWorkEnvelope request, HttpContext context,
        IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await FederationRoutingPolicy.IsEnabledAsync(db, ct)) return Results.NotFound();
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS is required.");
        var now = DateTimeOffset.UtcNow;
        var seconds = now.ToUnixTimeSeconds();
        if (!FederationAssignmentContract.TryDecode(request, out var payload) ||
            request.Timestamp < seconds - 300 || request.Timestamp > seconds + 300)
            return Results.BadRequest(new { error = "invalid_work_message" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(value =>
            value.InstanceId == request.SenderInstanceId && value.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null || peer.LastProofAt is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _) ||
            !FederationProbeProtocol.Verify(peerKey, FederationWorkProtocol.SignedBytes(request), request.Signature))
            return Results.Unauthorized();
        var destinationReady = await db.Sites.AsNoTracking().AnyAsync(value =>
            value.Id == request.DestinationSiteId && value.IsActive &&
            value.ParentOrganizationUnitId == null, ct);
        if (!destinationReady) return Results.StatusCode(403);
        var sourceName = await db.FederationRemoteSites.AsNoTracking()
            .Where(value => value.InstanceId == peer.InstanceId && value.SiteId == request.SourceSiteId && value.IsActive)
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
            var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.PayloadJson)));
            Guid localWorkId;
            bool duplicate;
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            if (await db.FederationProbeNonces.AsNoTracking().AnyAsync(value =>
                value.PeerInstanceId == peer.InstanceId && value.Nonce == request.Nonce, ct))
                return Results.Conflict(new { error = "replayed_work_message" });
            var previous = await db.FederationInboundReceipts.AsNoTracking().SingleOrDefaultAsync(value =>
                value.PeerInstanceId == peer.InstanceId && value.MessageId == request.MessageId, ct);
            if (previous is not null)
            {
                if (previous.MessageType != request.MessageType ||
                    previous.SourceSiteId != request.SourceSiteId ||
                    previous.DestinationSiteId != request.DestinationSiteId ||
                    previous.OriginInstanceId != request.OriginInstanceId ||
                    previous.OriginSiteId != request.OriginSiteId ||
                    previous.OriginResourceId != request.OriginResourceId ||
                    previous.CorrelationId != request.CorrelationId ||
                    previous.CausationId != request.CausationId ||
                    previous.PayloadSha256 != payloadHash)
                    return Results.Conflict(new { error = "message_identity_conflict" });
                localWorkId = previous.LocalWorkItemId;
                duplicate = true;
            }
            else
            {
                if (await db.FederationWorkLinks.AsNoTracking().AnyAsync(value =>
                    value.PeerInstanceId == peer.InstanceId && value.Direction == "incoming" &&
                    value.RemoteSiteId == request.SourceSiteId &&
                    value.OriginInstanceId == request.OriginInstanceId &&
                    value.OriginSiteId == request.OriginSiteId &&
                    value.OriginResourceId == request.OriginResourceId, ct))
                    return Results.Conflict(new { error = "origin_already_received" });
                localWorkId = Guid.NewGuid();
                duplicate = false;
                var item = new WorkItem(localWorkId, request.DestinationSiteId, null,
                    payload!.Title, payload.Instruction, null, payload.Priority, payload.DueAt, now,
                    senderSiteName: sourceName,
                    sourceTypeNameSnapshot: payload.SourceTypeName,
                    workItemTypeNameSnapshot: payload.Kind == "request" ? "Request" : null,
                    senderNameSnapshot: payload.SenderName,
                    requestBasisSnapshot: payload.RequestBasis,
                    originReference: payload.ReferenceCode,
                    originReferenceInstanceId: payload.ReferenceCode is null ? null : request.OriginInstanceId);
                db.WorkItems.Add(item);
                db.FederationWorkLinks.Add(new FederationWorkLink(Guid.NewGuid(), localWorkId,
                    peer.InstanceId, request.SourceSiteId, request.OriginInstanceId,
                    request.OriginSiteId, request.OriginResourceId, "incoming", now));
                db.FederationInboundReceipts.Add(new FederationInboundReceipt(peer.InstanceId,
                    request.MessageId, request.MessageType, request.SourceSiteId,
                    request.DestinationSiteId, request.OriginInstanceId, request.OriginSiteId,
                    request.OriginResourceId, request.CorrelationId, request.CausationId,
                    payloadHash, localWorkId, now));
                db.AuditEvents.Add(AuditEvent.FromFederatedPeer(Guid.NewGuid(),
                    request.DestinationSiteId, peer.InstanceId, request.SourceSiteId, sourceName,
                    payload.Kind == "request" ? "work-item.request-received" : "work-item.received-from-parent-site",
                    "work-item", localWorkId, now));
                DomainEventRecorder.Record(db, "assignment.created", request.DestinationSiteId,
                    null, "task", localWorkId, new { taskId = localWorkId, status = item.Status }, now);
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
                return Results.Conflict(new { error = "concurrent_work_message_retry" });
            }
            var receipt = new FederationWorkReceipt(FederationWorkProtocol.SchemaVersion,
                localId, peer.InstanceId, request.MessageId, request.Nonce, request.SourceSiteId,
                request.DestinationSiteId, localWorkId, payloadHash, 1,
                duplicate, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), string.Empty);
            receipt = receipt with
            {
                Signature = FederationProbeProtocol.Sign(localKey, FederationWorkReceiptProtocol.SignedBytes(receipt))
            };
            return Results.Ok(receipt);
        }
    }
}
