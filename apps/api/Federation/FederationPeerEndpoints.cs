using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationPeerEndpoints
{
    internal static void MapFederationPeerEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/federation/peers")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        // Keep historical configuration readable if an Enterprise license expires.
        group.MapGet("", async (FylkrenDbContext db, CancellationToken ct) =>
        {
            var peers = await db.FederationPeers.AsNoTracking()
                .OrderBy(peer => peer.Name)
                .Select(peer => new { peer.InstanceId, peer.Name, peer.BaseUrl, peer.CreatedAt, peer.IsActive, peer.LastProofAt,
                    peer.PinnedPublicKeySpki, peer.PendingKeyRotationId, peer.KeyRotationStagedAt })
                .ToListAsync(ct);
            return Results.Ok(peers.Select(peer =>
            {
                var valid = FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out _, out var fingerprint);
                return new { peer.InstanceId, peer.Name, peer.BaseUrl, peer.CreatedAt, peer.IsActive,
                    peer.LastProofAt, peer.PinnedPublicKeySpki, fingerprint = valid ? fingerprint : null,
                    keyRotationPending = peer.PendingKeyRotationId is not null,
                    peer.PendingKeyRotationId, peer.KeyRotationStagedAt,
                    trusted = peer.IsActive && valid && peer.LastProofAt is not null,
                    routable = false };
            }));
        });

        group.MapPost("/discover", async (PeerDiscoveryRequest request, ClaimsPrincipal user,
            IAntiforgery antiforgery, HttpContext context, IHttpClientFactory clients,
            FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!TryActor(user, out _)) return Results.Forbid();
            if (!TryNormalize("Discovery", request.BaseUrl, out _, out var baseUrl))
                return InvalidPeer();
            var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
                .Select(row => row.InstanceId).SingleAsync(ct);
            var discovered = await FederationPeerDiscovery.Fetch(baseUrl, localId, clients, ct);
            if (discovered is null)
                return Results.Problem(statusCode: 502,
                    title: "The peer's signed identity could not be verified.");
            if (await db.FederationPeers.AsNoTracking().AnyAsync(row =>
                    row.InstanceId == discovered.InstanceId, ct))
                return Results.Conflict(new { error = "federation_peer_exists" });
            return Results.Ok(new { discovered.InstanceId, baseUrl,
                discovered.Fingerprint, verifiedAt = discovered.ProvedAt });
        }).RequireFeature(FeatureCatalog.InstanceFederation)
            .RequireRateLimiting("costly-operation");

        group.MapPost("/{instanceId:guid}/key-recovery/discover", async (Guid instanceId,
            ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            IHttpClientFactory clients, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!TryActor(user, out _)) return Results.Forbid();
            var peer = await db.FederationPeers.AsNoTracking()
                .SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
            if (peer is null) return Results.NotFound();
            if (!peer.IsActive) return Results.Conflict(new { error = "federation_peer_inactive" });
            var discovered = await FederationPeerDiscovery.Fetch(peer.BaseUrl,
                await LocalInstanceId(db, ct), clients, ct);
            if (discovered is null || discovered.InstanceId != instanceId)
                return Results.Problem(statusCode: 502,
                    title: "The peer's new signed identity could not be verified.");
            if (discovered.PublicKeySpki == peer.PinnedPublicKeySpki)
                return Results.Conflict(new { error = "federation_peer_key_unchanged" });
            return Results.Ok(new { discovered.InstanceId, peer.BaseUrl,
                discovered.Fingerprint, verifiedAt = discovered.ProvedAt });
        }).RequireFeature(FeatureCatalog.InstanceFederation)
            .RequireRateLimiting("costly-operation");

        group.MapPost("/{instanceId:guid}/key-recovery", async (Guid instanceId,
            PeerKeyRecoveryRequest request, ClaimsPrincipal user, IAntiforgery antiforgery,
            HttpContext context, IHttpClientFactory clients, FylkrenDbContext db,
            CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!TryActor(user, out var actor)) return Results.Forbid();
            if (string.IsNullOrWhiteSpace(request.Fingerprint)) return InvalidPeer();
            var peer = await db.FederationPeers.SingleOrDefaultAsync(value =>
                value.InstanceId == instanceId, ct);
            if (peer is null) return Results.NotFound();
            if (!peer.IsActive) return Results.Conflict(new { error = "federation_peer_inactive" });
            var discovered = await FederationPeerDiscovery.Fetch(peer.BaseUrl,
                await LocalInstanceId(db, ct), clients, ct);
            if (discovered is null || discovered.InstanceId != instanceId ||
                !string.Equals(discovered.Fingerprint, request.Fingerprint.Trim(),
                    StringComparison.OrdinalIgnoreCase))
                return Results.Conflict(new { error = "federation_peer_recovery_identity_changed" });
            if (discovered.PublicKeySpki == peer.PinnedPublicKeySpki)
                return Results.Conflict(new { error = "federation_peer_key_unchanged" });
            var localKey = await db.FederationSigningIdentities.AsNoTracking()
                .Where(row => row.Key == 1).Select(row => row.PublicKeySpki)
                .SingleOrDefaultAsync(ct);
            if (discovered.PublicKeySpki == localKey)
                return Results.Conflict(new { error = "federation_peer_uses_local_key" });
            if (await db.FederationPeers.AsNoTracking().AnyAsync(row =>
                    row.InstanceId != instanceId &&
                    (row.PinnedPublicKeySpki == discovered.PublicKeySpki ||
                     row.PendingPinnedPublicKeySpki == discovered.PublicKeySpki), ct))
                return Results.Conflict(new { error = "federation_key_already_pinned" });

            var now = DateTimeOffset.UtcNow;
            peer.RecoverPinnedKey(discovered.PublicKeySpki, discovered.ProvedAt);
            var remoteSites = await db.FederationRemoteSites
                .Where(site => site.InstanceId == instanceId).ToListAsync(ct);
            foreach (var site in remoteSites) site.Suspend(now);
            await FederationSiteGrantPolicy.SuspendPeerAsync(instanceId, db, now, ct);
            AddAudit(db, actor, instanceId, "federation-peer.key-recovery-approved", now);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict(new { error = "federation_peer_key_recovery_conflict" });
            }
            return Results.Ok(new { peer.InstanceId, discovered.Fingerprint,
                peer.LastProofAt, grantsSuspended = true, catalogSuspended = true });
        }).RequireFeature(FeatureCatalog.InstanceFederation)
            .RequireRateLimiting("costly-operation");

        group.MapPost("", async (PeerRequest request, ClaimsPrincipal user, IAntiforgery antiforgery,
            HttpContext context, IHttpClientFactory clients, FylkrenDbContext db,
            CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!TryActor(user, out var actor)) return Results.Forbid();
            if (await db.FederationSigningIdentities.AsNoTracking().AnyAsync(row => row.Key == 1 &&
                    (row.PendingRotationId != null || row.ActiveRotationId != null), ct))
                return Results.Conflict(new { error = "federation_key_rotation_in_progress" });
            if (request.InstanceId == Guid.Empty || string.IsNullOrWhiteSpace(request.Fingerprint) ||
                !TryNormalize(request.Name, request.BaseUrl, out var name, out var baseUrl))
                return InvalidPeer();
            var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
                .Select(row => row.InstanceId).SingleAsync(ct);
            if (request.InstanceId == localId)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["instanceId"] = ["The local instance cannot be registered as a remote instance."] });
            if (await db.FederationPeers.AnyAsync(peer => peer.InstanceId == request.InstanceId, ct))
                return Results.Conflict(new { error = "federation_peer_exists" });
            var discovered = await FederationPeerDiscovery.Fetch(baseUrl, localId, clients, ct);
            if (discovered is null)
                return Results.Problem(statusCode: 502,
                    title: "The peer's signed identity could not be verified.");
            if (discovered.InstanceId != request.InstanceId ||
                !string.Equals(discovered.Fingerprint, request.Fingerprint.Trim(),
                    StringComparison.OrdinalIgnoreCase))
                return Results.Conflict(new { error = "federation_peer_identity_changed" });
            var localKey = await db.FederationSigningIdentities.AsNoTracking()
                .Where(row => row.Key == 1).Select(row => row.PublicKeySpki)
                .SingleOrDefaultAsync(ct);
            if (localKey is null)
                return Results.Conflict(new { error = "federation_identity_missing" });
            if (discovered.PublicKeySpki == localKey)
                return Results.Conflict(new { error = "federation_peer_uses_local_key" });
            if (await db.FederationPeers.AsNoTracking().AnyAsync(row =>
                    row.PinnedPublicKeySpki == discovered.PublicKeySpki, ct))
                return Results.Conflict(new { error = "federation_key_already_pinned" });
            var now = DateTimeOffset.UtcNow;
            var peer = new FederationPeer(request.InstanceId, name, baseUrl, now);
            peer.PinPublicKey(discovered.PublicKeySpki);
            peer.RecordProof(discovered.ProvedAt);
            db.FederationPeers.Add(peer);
            AddAudit(db, actor, peer.InstanceId, "federation-peer.approved", now);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/platform/federation/peers/{peer.InstanceId}",
                new { peer.InstanceId, peer.Name, peer.BaseUrl, peer.CreatedAt, peer.IsActive,
                    peer.LastProofAt, discovered.Fingerprint, trusted = true, routable = false });
        }).RequireFeature(FeatureCatalog.InstanceFederation)
            .RequireRateLimiting("costly-operation");

        group.MapPut("/{instanceId:guid}", async (Guid instanceId, PeerDetails request, ClaimsPrincipal user,
            IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!TryActor(user, out var actor)) return Results.Forbid();
            if (!TryNormalize(request.Name, request.BaseUrl, out var name, out var baseUrl)) return InvalidPeer();
            var peer = await db.FederationPeers.SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
            if (peer is null) return Results.NotFound();
            if (!peer.IsActive) return Results.Conflict(new { error = "federation_peer_inactive" });
            var endpointChanged = peer.BaseUrl != baseUrl;
            peer.Update(name, baseUrl);
            if (endpointChanged)
            {
                var remoteSites = await db.FederationRemoteSites.Where(site => site.InstanceId == instanceId).ToListAsync(ct);
                foreach (var site in remoteSites) site.Suspend(DateTimeOffset.UtcNow);
                await FederationSiteGrantPolicy.SuspendPeerAsync(instanceId, db, DateTimeOffset.UtcNow, ct);
            }
            AddAudit(db, actor, instanceId, "federation-peer.updated", DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { peer.InstanceId, peer.Name, peer.BaseUrl,
                peer.CreatedAt, peer.IsActive, peer.LastProofAt,
                trusted = peer.PinnedPublicKeySpki is not null && peer.LastProofAt is not null,
                routable = false });
        }).RequireFeature(FeatureCatalog.InstanceFederation);

        group.MapDelete("/{instanceId:guid}", async (Guid instanceId, ClaimsPrincipal user,
            IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!TryActor(user, out var actor)) return Results.Forbid();
            var peer = await db.FederationPeers.SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
            if (peer is null) return Results.NotFound();
            if (!peer.IsActive) return Results.NoContent();
            peer.Deactivate(); // Preserve identity and audit trail; do not recycle peer IDs.
            var remoteSites = await db.FederationRemoteSites.Where(site => site.InstanceId == instanceId).ToListAsync(ct);
            foreach (var site in remoteSites) site.Suspend(DateTimeOffset.UtcNow);
            await FederationSiteGrantPolicy.SuspendPeerAsync(instanceId, db, DateTimeOffset.UtcNow, ct);
            AddAudit(db, actor, instanceId, "federation-peer.deactivated", DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireFeature(FeatureCatalog.InstanceFederation);

    }

    private static bool TryActor(ClaimsPrincipal user, out Guid actor) =>
        Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out actor);

    private static void AddAudit(FylkrenDbContext db, Guid actor, Guid peerId, string eventType, DateTimeOffset at)
    {
        var audit = new AuditEvent(Guid.NewGuid(), null, actor, eventType, "federation-peer", peerId, at);
        audit.SnapshotActorRole(true);
        db.AuditEvents.Add(audit);
    }

    private static bool TryNormalize(string? rawName, string? rawUrl, out string name, out string baseUrl)
    {
        name = rawName?.Trim() ?? string.Empty;
        baseUrl = string.Empty;
        if (name.Length is < 2 or > 120 || rawUrl is null || rawUrl.Length > 2048 ||
            !Uri.TryCreate(rawUrl.Trim(), UriKind.Absolute, out var uri) ||
            uri.Scheme != Uri.UriSchemeHttps || string.IsNullOrWhiteSpace(uri.Host) ||
            !string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath != "/" ||
            !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment)) return false;
        baseUrl = uri.GetLeftPart(UriPartial.Authority);
        return true;
    }

    private static IResult InvalidPeer() => Results.ValidationProblem(new Dictionary<string, string[]>
    {
        ["peer"] = ["Enter a valid instance ID, name, and HTTPS base address without a path, query, or fragment."]
    });

    private sealed record PeerDiscoveryRequest(string? BaseUrl);
    private sealed record PeerKeyRecoveryRequest(string? Fingerprint);
    private sealed record PeerRequest(Guid InstanceId, string? Name, string? BaseUrl,
        string? Fingerprint);
    private sealed record PeerDetails(string? Name, string? BaseUrl);

    private static Task<Guid> LocalInstanceId(FylkrenDbContext db, CancellationToken ct) =>
        db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
}
