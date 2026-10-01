using System.Net.Http.Json;
using System.Security.Claims;
using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fylkren.Api.Federation;

internal static class FederationCatalogEndpoints
{
    internal static void MapFederationCatalogEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/catalog", Receive)
            .AllowAnonymous().RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);
        var group = endpoints.MapGroup("/api/platform/federation/peers/{instanceId:guid}/catalog")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("", async (Guid instanceId, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await db.FederationPeers.AnyAsync(peer => peer.InstanceId == instanceId, ct)) return Results.NotFound();
            var rows = await db.FederationRemoteSites.AsNoTracking()
                .Where(site => site.InstanceId == instanceId).OrderBy(site => site.Name)
                .Select(site => new { site.SiteId, site.Name, site.IsActive, site.CatalogRevision, site.UpdatedAt })
                .ToListAsync(ct);
            return Results.Ok(rows);
        });
        group.MapPost("/sync", Sync).RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Receive(FederationCatalogRequest request, HttpContext context,
        IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS kreves.");
        var now = DateTimeOffset.UtcNow;
        if (request.SchemaVersion != FederationCatalogProtocol.SchemaVersion ||
            request.SenderInstanceId == Guid.Empty || request.RecipientInstanceId == Guid.Empty ||
            request.Nonce == Guid.Empty || !Fresh(request.Timestamp, now))
            return Results.BadRequest(new { error = "invalid_catalog_request" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId || request.SenderInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(value =>
            value.InstanceId == request.SenderInstanceId && value.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _) ||
            !FederationProbeProtocol.Verify(peerKey,
                FederationCatalogProtocol.RequestBytes(request.SenderInstanceId, localId, request.Timestamp, request.Nonce),
                request.Signature)) return Results.Unauthorized();
        var localKey = await db.FederationSigningIdentities.AsNoTracking().SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (localKey is null) return Results.Problem(statusCode: 503, title: "The federation key is missing.");
        // Approved peers automatically see active top-level sites. Inactive root sites are
        // included as revocations; attached child sites are omitted and suspended by sync.
        var sites = await db.Sites.AsNoTracking()
            .Where(site => site.ParentOrganizationUnitId == null)
            .Select(site => new FederationCatalogSite(site.Id, site.Name,
                1_000_000_000L + site.Version, site.IsActive))
            .ToArrayAsync(ct);
        if (!FederationCatalogProtocol.ValidSites(sites))
            return Results.Problem(statusCode: 503, title: "The site catalogue cannot be published.");
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        string signature;
        try
        {
            using var key = FederationSigningKeys.Load(localKey, protection);
            signature = FederationProbeProtocol.Sign(key,
                FederationCatalogProtocol.ResponseBytes(localId, peer.InstanceId, timestamp, request.Nonce, sites));
        }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "The federation key cannot be used.");
        }
        db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "replayed_catalog_request" });
        }
        return Results.Ok(new FederationCatalogResponse(FederationCatalogProtocol.SchemaVersion,
            localId, peer.InstanceId, timestamp, request.Nonce, sites, signature));
    }

    private static async Task<IResult> Sync(Guid instanceId, ClaimsPrincipal user, IAntiforgery antiforgery,
        HttpContext context, IDataProtectionProvider protection, IHttpClientFactory clients,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
        var peer = await db.FederationPeers.SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
        if (peer is null) return Results.NotFound();
        if (!peer.IsActive || peer.LastProofAt is null || peer.PinnedPublicKeySpki is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _))
            return Results.Conflict(new { error = "federation_peer_not_proved" });
        var identity = await db.FederationSigningIdentities.AsNoTracking().SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (identity is null) return Results.Conflict(new { error = "federation_identity_missing" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var nonce = Guid.NewGuid();
        string signature;
        try
        {
            using var key = FederationSigningKeys.Load(identity, protection);
            signature = FederationProbeProtocol.Sign(key,
                FederationCatalogProtocol.RequestBytes(localId, instanceId, timestamp, nonce));
        }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "The federation key cannot be used.");
        }
        try
        {
            var target = new Uri(new Uri(peer.BaseUrl + "/"), "api/federation/v1/catalog");
            using var outgoing = new HttpRequestMessage(HttpMethod.Post, target)
            {
                Content = JsonContent.Create(new FederationCatalogRequest(FederationCatalogProtocol.SchemaVersion,
                    localId, instanceId, timestamp, nonce, signature))
            };
            using var response = await clients.CreateClient("federation-probe")
                .SendAsync(outgoing, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
                return Results.Problem(statusCode: 502, title: "The peer rejected the catalogue request.");
            await response.Content.LoadIntoBufferAsync(1_000_000, ct);
            var catalog = await response.Content.ReadFromJsonAsync<FederationCatalogResponse>(cancellationToken: ct);
            var now = DateTimeOffset.UtcNow;
            if (catalog is null || catalog.SchemaVersion != FederationCatalogProtocol.SchemaVersion ||
                catalog.SenderInstanceId != instanceId || catalog.RecipientInstanceId != localId ||
                catalog.Nonce != nonce || !Fresh(catalog.Timestamp, now) ||
                !FederationCatalogProtocol.ValidSites(catalog.Sites) ||
                !FederationProbeProtocol.Verify(peerKey, FederationCatalogProtocol.ResponseBytes(instanceId,
                    localId, catalog.Timestamp, nonce, catalog.Sites), catalog.Signature))
                return Results.Problem(statusCode: 502, title: "The site catalogue signature or contents could not be verified.");
            var known = await db.FederationRemoteSites.Where(site => site.InstanceId == instanceId)
                .ToDictionaryAsync(site => site.SiteId, ct);
            var changed = 0;
            foreach (var site in catalog.Sites)
            {
                var acceptedInactive = !site.IsActive;
                if (known.TryGetValue(site.SiteId, out var existing))
                {
                    acceptedInactive &= site.Revision >= existing.CatalogRevision;
                    if (existing.ApplySnapshot(site.Name, site.Revision, site.IsActive, now)) changed++;
                }
                else
                {
                    var added = new FederationRemoteSite(instanceId, site.SiteId, site.Name,
                        site.Revision, site.IsActive, now);
                    db.FederationRemoteSites.Add(added);
                    changed++;
                }
                if (acceptedInactive)
                    await FederationSiteGrantPolicy.SuspendRemoteAsync(instanceId, site.SiteId, db, now, ct);
            }
            var receivedIds = catalog.Sites.Select(site => site.SiteId).ToHashSet();
            foreach (var existing in known.Values.Where(site => !receivedIds.Contains(site.SiteId)))
            {
                if (existing.Suspend(now)) changed++;
                await FederationSiteGrantPolicy.SuspendRemoteAsync(instanceId, existing.SiteId, db, now, ct);
            }
            var audit = new AuditEvent(Guid.NewGuid(), null, actor, "federation-catalog.synced", "federation-peer", instanceId, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { peerInstanceId = instanceId, received = catalog.Sites.Length, changed, routable = false });
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException or InvalidOperationException)
        {
            return Results.Problem(statusCode: 502, title: "The site catalogue could not be synchronized.");
        }
    }

    private static bool Fresh(long timestamp, DateTimeOffset now) =>
        timestamp >= now.ToUnixTimeSeconds() - 300 && timestamp <= now.ToUnixTimeSeconds() + 300;
}
