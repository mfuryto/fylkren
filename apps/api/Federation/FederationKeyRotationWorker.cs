using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal sealed class FederationKeyRotationWorker(IServiceScopeFactory scopes,
    IHttpClientFactory clients, IDataProtectionProvider protection,
    ILogger<FederationKeyRotationWorker> logger) : BackgroundService
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
                if (await license.Has(db, FeatureCatalog.InstanceFederation, ct))
                    await ProcessAsync(db, ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Federation key rotation processing failed."); }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }

    private async Task ProcessAsync(FylkrenDbContext db, CancellationToken ct)
    {
        var identity = await db.FederationSigningIdentities
            .SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (identity?.PendingRotationId is Guid pendingId)
            await StageAsync(identity, pendingId, db, ct);
        else if (identity?.ActiveRotationId is Guid activeId)
            await CompleteAsync(identity, activeId, db, ct);
    }

    private async Task StageAsync(FederationSigningIdentity identity, Guid rotationId,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (identity.PendingPublicKeySpki is null || identity.PendingProtectedPrivateKey is null ||
            identity.PendingCreatedAt is null) return;
        var localId = await LocalInstanceId(db, ct);
        var peers = await ActivePeers(db, ct);
        if (peers.Any(peer => peer.PinnedPublicKeySpki is null || peer.LastProofAt is null))
        {
            logger.LogWarning("Federation key rotation {RotationId} waits because an active peer is not proved.", rotationId);
            return;
        }
        using var currentKey = FederationSigningKeys.Load(identity, protection);
        using var pendingKey = FederationSigningKeys.Load(new FederationSigningIdentity(
            identity.PendingPublicKeySpki, identity.PendingProtectedPrivateKey,
            identity.PendingCreatedAt.Value), protection);
        if (!FederationPublicKey.TryParse(identity.PublicKeySpki, out _, out var currentFingerprint) ||
            !FederationPublicKey.TryParse(identity.PendingPublicKeySpki, out _, out var newFingerprint)) return;
        foreach (var peer in peers)
        {
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var nonce = Guid.NewGuid();
            var bytes = FederationKeyRotationProtocol.StageBytes(localId, peer.InstanceId,
                rotationId, timestamp, nonce, currentFingerprint, newFingerprint,
                peer.SignatureAlgorithm);
            var request = new FederationKeyRotationStageRequest(localId, peer.InstanceId,
                rotationId, timestamp, nonce, identity.PublicKeySpki,
                identity.PendingPublicKeySpki,
                FederationKeyRotationProtocol.Sign(currentKey, bytes),
                FederationKeyRotationProtocol.Sign(pendingKey, bytes), peer.SignatureAlgorithm);
            if (!await SendAndVerify(peer, localId, rotationId, "staged",
                    "api/federation/v1/key-rotation/stage", request, ct)) return;
        }
        identity.ActivateRotation(rotationId);
        db.AuditEvents.Add(AuditEvent.FromFederatedInstance(Guid.NewGuid(), localId,
            "federation-identity.key-rotation-activated", "federation-identity",
            localId, DateTimeOffset.UtcNow));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            logger.LogInformation("Another replica advanced federation key rotation {RotationId}.", rotationId);
        }
    }

    private async Task CompleteAsync(FederationSigningIdentity identity, Guid rotationId,
        FylkrenDbContext db, CancellationToken ct)
    {
        var localId = await LocalInstanceId(db, ct);
        var peers = await ActivePeers(db, ct);
        using var key = FederationSigningKeys.Load(identity, protection);
        foreach (var peer in peers)
        {
            if (peer.PinnedPublicKeySpki is null)
            {
                logger.LogWarning("Federation key rotation {RotationId} waits for a pinned key on peer {PeerId}.",
                    rotationId, peer.InstanceId);
                return;
            }
            var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            var nonce = Guid.NewGuid();
            var request = new FederationKeyRotationCompleteRequest(localId, peer.InstanceId,
                rotationId, timestamp, nonce, FederationKeyRotationProtocol.Sign(key,
                    FederationKeyRotationProtocol.CompleteBytes(localId, peer.InstanceId,
                        rotationId, timestamp, nonce, peer.SignatureAlgorithm)),
                peer.SignatureAlgorithm);
            if (!await SendAndVerify(peer, localId, rotationId, "completed",
                    "api/federation/v1/key-rotation/complete", request, ct)) return;
        }
        identity.CompleteRotation(rotationId);
        db.AuditEvents.Add(AuditEvent.FromFederatedInstance(Guid.NewGuid(), localId,
            "federation-identity.key-rotation-completed", "federation-identity",
            localId, DateTimeOffset.UtcNow));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            logger.LogInformation("Another replica completed federation key rotation {RotationId}.", rotationId);
        }
    }

    private async Task<bool> SendAndVerify<T>(PeerTarget peer, Guid localId,
        Guid rotationId, string phase, string path, T payload, CancellationToken ct)
    {
        if (!FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _))
            return false;
        try
        {
            var target = new Uri(new Uri(peer.BaseUrl + "/"), path);
            using var message = new HttpRequestMessage(HttpMethod.Post, target)
            {
                Content = JsonContent.Create(payload)
            };
            using var response = await clients.CreateClient("federation-probe")
                .SendAsync(message, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                var code = await ErrorCode(response, ct);
                if (response.StatusCode == HttpStatusCode.Conflict && code == "federation_clock_skew")
                    logger.LogWarning("Federation key rotation {RotationId} waits for peer {PeerId}: clock_skew.",
                        rotationId, peer.InstanceId);
                else
                    logger.LogWarning("Federation key rotation {RotationId} waits for peer {PeerId}: HTTP {Status} ({Code}).",
                        rotationId, peer.InstanceId, (int)response.StatusCode, code);
                return false;
            }
            await response.Content.LoadIntoBufferAsync(16_384, ct);
            var receipt = await response.Content.ReadFromJsonAsync<FederationKeyRotationReceipt>(cancellationToken: ct);
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (receipt is null || receipt.SenderInstanceId != peer.InstanceId ||
                receipt.RecipientInstanceId != localId || receipt.RotationId != rotationId ||
                receipt.Phase != phase || receipt.Nonce == Guid.Empty ||
                receipt.SignatureAlgorithm != peer.SignatureAlgorithm ||
                receipt.Timestamp < now - 300 || receipt.Timestamp > now + 300 ||
                !FederationKeyRotationProtocol.Verify(peerKey,
                    FederationKeyRotationProtocol.ReceiptBytes(peer.InstanceId, localId,
                        rotationId, phase, receipt.Timestamp, receipt.Nonce,
                        peer.SignatureAlgorithm), receipt.Signature))
            {
                logger.LogWarning("Federation key rotation {RotationId} received an invalid receipt from {PeerId}.",
                    rotationId, peer.InstanceId);
                return false;
            }
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
            JsonException or CryptographicException)
        {
            logger.LogWarning(ex, "Federation key rotation {RotationId} waits for peer {PeerId}.",
                rotationId, peer.InstanceId);
            return false;
        }
    }

    private static async Task<string?> ErrorCode(HttpResponseMessage response, CancellationToken ct)
    {
        try
        {
            await response.Content.LoadIntoBufferAsync(16_384, ct);
            using var json = await JsonDocument.ParseAsync(await response.Content.ReadAsStreamAsync(ct),
                cancellationToken: ct);
            return json.RootElement.TryGetProperty("error", out var value) ? value.GetString() : null;
        }
        catch (JsonException) { return null; }
    }

    private static Task<Guid> LocalInstanceId(FylkrenDbContext db, CancellationToken ct) =>
        db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);

    private static Task<List<PeerTarget>> ActivePeers(FylkrenDbContext db, CancellationToken ct) =>
        db.FederationPeers.AsNoTracking().Where(row => row.IsActive)
            .OrderBy(row => row.InstanceId)
            .Select(row => new PeerTarget(row.InstanceId, row.BaseUrl,
                row.PinnedPublicKeySpki, row.LastProofAt, row.SignatureAlgorithm)).ToListAsync(ct);

    private sealed record PeerTarget(Guid InstanceId, string BaseUrl,
        string? PinnedPublicKeySpki, DateTimeOffset? LastProofAt,
        string? SignatureAlgorithm);
}
