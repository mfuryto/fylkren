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

// Only the previously acknowledged outgoing work item may receive an answer.
// This route is registered in FederationTest, never in ordinary installations.
internal static class FederationOfficialAnswerReceiveEndpoints
{
    internal static void MapFederationOfficialAnswerReceiveEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/answer", Receive)
            .AllowAnonymous().RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation)
            .WithMetadata(new RequestSizeLimitAttribute(150_000));
    }

    private static async Task<IResult> Receive(FederationWorkEnvelope request, HttpContext context,
        IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await FederationRoutingPolicy.IsEnabledAsync(db, ct)) return Results.NotFound();
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS is required.");
        var now = DateTimeOffset.UtcNow;
        var seconds = now.ToUnixTimeSeconds();
        if (!FederationOfficialAnswerContract.TryDecode(request, out var answer) ||
            request.Timestamp < seconds - 300 || request.Timestamp > seconds + 300)
            return Results.BadRequest(new { error = "invalid_official_answer" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId || request.OriginInstanceId != localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(value =>
            value.InstanceId == request.SenderInstanceId && value.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null || peer.LastProofAt is null ||
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
                return Results.Conflict(new { error = "replayed_answer" });
            var link = await db.FederationWorkLinks.SingleOrDefaultAsync(value =>
                value.Direction == "outgoing" && value.LocalWorkItemId == request.OriginResourceId &&
                value.PeerInstanceId == peer.InstanceId && value.RemoteSiteId == request.SourceSiteId &&
                value.OriginInstanceId == localId && value.OriginSiteId == request.DestinationSiteId &&
                value.RemoteWorkItemId == request.CounterpartWorkItemId, ct);
            if (link is null || !await db.WorkItems.AsNoTracking().AnyAsync(value =>
                    value.Id == link.LocalWorkItemId && value.SiteId == request.DestinationSiteId, ct))
                return Results.StatusCode(403);
            var originalSent = await db.FederationOutboundMessages.AsNoTracking().AnyAsync(value =>
                value.MessageId == request.CorrelationId &&
                value.MessageId == request.CausationId &&
                value.MessageType == "assignment.created" && value.Status == "delivered" &&
                value.PeerInstanceId == peer.InstanceId &&
                value.SourceSiteId == request.DestinationSiteId &&
                value.DestinationSiteId == request.SourceSiteId &&
                value.OriginResourceId == link.LocalWorkItemId, ct);
            if (!originalSent) return Results.StatusCode(403);
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
                 previous.PayloadSha256 != hash || previous.LocalWorkItemId != link.LocalWorkItemId))
                return Results.Conflict(new { error = "answer_message_identity_conflict" });
            if (link.OfficialAnswerMessageId is Guid existing && existing != request.MessageId)
                return Results.Conflict(new { error = "official_answer_already_recorded" });
            if (previous is null)
            {
                link.RecordOfficialAnswer(request.MessageId, answer!.OfficialReport,
                    answer.Classification, answer.ApprovedAt, sourceName);
                db.FederationInboundReceipts.Add(new FederationInboundReceipt(peer.InstanceId,
                    request.MessageId, request.MessageType, request.SourceSiteId,
                    request.DestinationSiteId, request.OriginInstanceId, request.OriginSiteId,
                    request.OriginResourceId, request.CorrelationId, request.CausationId,
                    hash, link.LocalWorkItemId, now));
                Fylkren.Api.DomainEvents.WorkActivity.Add(db, AuditEvent.FromFederatedPeer(Guid.NewGuid(),
                    request.DestinationSiteId, peer.InstanceId, request.SourceSiteId, sourceName,
                    "work-item.official-answer-received", "work-item", link.LocalWorkItemId, now), "report.received", null, sourceMessageId: request.MessageId, correlationId: request.CorrelationId);
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
                return Results.Conflict(new { error = "concurrent_answer_retry" });
            }
            var receipt = new FederationWorkReceipt(FederationWorkProtocol.SchemaVersion,
                localId, peer.InstanceId, request.MessageId, request.Nonce, request.SourceSiteId,
                request.DestinationSiteId, link.LocalWorkItemId, hash, 0,
                previous is not null, DateTimeOffset.UtcNow.ToUnixTimeSeconds(), string.Empty);
            return Results.Ok(receipt with
            {
                Signature = FederationProbeProtocol.Sign(localKey,
                    FederationWorkReceiptProtocol.SignedBytes(receipt))
            });
        }
    }
}
