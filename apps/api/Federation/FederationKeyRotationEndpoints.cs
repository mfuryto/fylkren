using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fylkren.Api.Federation;

internal static class FederationKeyRotationEndpoints
{
    internal static void MapFederationKeyRotationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/federation/v1/key-rotation")
            .AllowAnonymous()
            .RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);
        group.MapPost("/stage", Stage);
        group.MapPost("/complete", Complete);
    }

    private static async Task<IResult> Stage(FederationKeyRotationStageRequest request,
        HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db,
        CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS kreves.");
        var now = DateTimeOffset.UtcNow;
        if (!Fresh(request.Timestamp, now))
            return Results.Conflict(new { error = "federation_clock_skew" });
        if (!ValidAddress(request.SenderInstanceId, request.RecipientInstanceId,
                request.RotationId, request.Nonce))
            return Results.BadRequest(new { error = "invalid_key_rotation" });
        var localId = await LocalInstanceId(db, ct);
        if (request.RecipientInstanceId != localId || request.SenderInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.SingleOrDefaultAsync(row =>
            row.InstanceId == request.SenderInstanceId && row.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null)
            return Results.Unauthorized();

        if (!FederationPublicKey.TryParse(request.CurrentPublicKeySpki, out var currentKey, out var currentFingerprint) ||
            !FederationPublicKey.TryParse(request.NewPublicKeySpki, out var newKey, out var newFingerprint))
            return Results.BadRequest(new { error = "invalid_key_rotation_key" });
        var currentEncoded = Convert.ToBase64String(currentKey);
        var newEncoded = Convert.ToBase64String(newKey);
        var stagedReplay = peer.PendingKeyRotationId == request.RotationId &&
            peer.PendingPinnedPublicKeySpki == newEncoded && peer.PinnedPublicKeySpki == currentEncoded;
        if (peer.LastCompletedKeyRotationId == request.RotationId)
            return Results.Conflict(new { error = "federation_key_rotation_completed" });
        if (peer.PinnedPublicKeySpki != currentEncoded)
            return Results.Unauthorized();
        if (!stagedReplay && peer.PendingKeyRotationId is not null)
            return Results.Conflict(new { error = "federation_key_rotation_conflict" });
        if (currentEncoded == newEncoded || await KeyUsedByAnotherPeer(db, peer.InstanceId, newEncoded, ct))
            return Results.Conflict(new { error = "federation_key_already_pinned" });
        var canonical = FederationKeyRotationProtocol.StageBytes(request.SenderInstanceId,
            localId, request.RotationId, request.Timestamp, request.Nonce,
            currentFingerprint, newFingerprint);
        if (!FederationKeyRotationProtocol.Verify(currentKey, canonical, request.CurrentSignature) ||
            !FederationKeyRotationProtocol.Verify(newKey, canonical, request.NewSignature))
            return Results.Unauthorized();

        db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
        if (!stagedReplay)
        {
            peer.StageKeyRotation(request.RotationId, currentEncoded, newEncoded, now);
            db.AuditEvents.Add(AuditEvent.FromFederatedInstance(Guid.NewGuid(), peer.InstanceId,
                "federation-peer.key-rotation-staged", "federation-peer", peer.InstanceId, now));
        }
        var receipt = await SignedReceipt(localId, peer.InstanceId, request.RotationId,
            "staged", protection, db, ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "replayed_key_rotation" });
        }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict(new { error = "federation_key_rotation_conflict" });
        }
        return Results.Ok(receipt);
    }

    private static async Task<IResult> Complete(FederationKeyRotationCompleteRequest request,
        HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db,
        CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS kreves.");
        var now = DateTimeOffset.UtcNow;
        if (!Fresh(request.Timestamp, now))
            return Results.Conflict(new { error = "federation_clock_skew" });
        if (!ValidAddress(request.SenderInstanceId, request.RecipientInstanceId,
                request.RotationId, request.Nonce))
            return Results.BadRequest(new { error = "invalid_key_rotation" });
        var localId = await LocalInstanceId(db, ct);
        if (request.RecipientInstanceId != localId || request.SenderInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.SingleOrDefaultAsync(row =>
            row.InstanceId == request.SenderInstanceId && row.IsActive, ct);
        if (peer is null) return Results.Unauthorized();
        var replay = peer.PendingKeyRotationId is null &&
            peer.LastCompletedKeyRotationId == request.RotationId;
        var encoded = replay ? peer.PinnedPublicKeySpki : peer.PendingPinnedPublicKeySpki;
        if ((replay || peer.PendingKeyRotationId == request.RotationId) &&
            FederationPublicKey.TryParse(encoded, out var key, out _) &&
            FederationKeyRotationProtocol.Verify(key,
                FederationKeyRotationProtocol.CompleteBytes(request.SenderInstanceId,
                    localId, request.RotationId, request.Timestamp, request.Nonce),
                request.Signature))
        {
            db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
            if (!replay)
            {
                peer.CompleteKeyRotation(request.RotationId, now);
                db.AuditEvents.Add(AuditEvent.FromFederatedInstance(Guid.NewGuid(), peer.InstanceId,
                    "federation-peer.key-rotation-completed", "federation-peer", peer.InstanceId, now));
            }
            var receipt = await SignedReceipt(localId, peer.InstanceId, request.RotationId,
                "completed", protection, db, ct);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateException ex) when (ex.InnerException is PostgresException
                { SqlState: PostgresErrorCodes.UniqueViolation })
            {
                return Results.Conflict(new { error = "replayed_key_rotation" });
            }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict(new { error = "federation_key_rotation_conflict" });
            }
            return Results.Ok(receipt);
        }
        return Results.Unauthorized();
    }

    private static async Task<FederationKeyRotationReceipt> SignedReceipt(Guid sender,
        Guid recipient, Guid rotationId, string phase, IDataProtectionProvider protection,
        FylkrenDbContext db, CancellationToken ct)
    {
        var identity = await db.FederationSigningIdentities.AsNoTracking()
            .SingleAsync(row => row.Key == 1, ct);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var nonce = Guid.NewGuid();
        using var key = FederationSigningKeys.Load(identity, protection);
        var signature = FederationKeyRotationProtocol.Sign(key,
            FederationKeyRotationProtocol.ReceiptBytes(sender, recipient, rotationId,
                phase, timestamp, nonce));
        return new FederationKeyRotationReceipt(sender, recipient, rotationId,
            phase, timestamp, nonce, signature);
    }

    private static bool Fresh(long timestamp, DateTimeOffset now) =>
        timestamp >= now.ToUnixTimeSeconds() - 300 && timestamp <= now.ToUnixTimeSeconds() + 300;

    private static bool ValidAddress(Guid sender, Guid recipient, Guid rotation, Guid nonce) =>
        sender != Guid.Empty && recipient != Guid.Empty && rotation != Guid.Empty && nonce != Guid.Empty;

    private static Task<Guid> LocalInstanceId(FylkrenDbContext db, CancellationToken ct) =>
        db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);

    private static Task<bool> KeyUsedByAnotherPeer(FylkrenDbContext db, Guid peerId,
        string key, CancellationToken ct) => db.FederationPeers.AsNoTracking().AnyAsync(row =>
            row.InstanceId != peerId &&
            (row.PinnedPublicKeySpki == key || row.PendingPinnedPublicKeySpki == key), ct);
}
