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

internal static class FederationGrantCheckEndpoints
{
    internal static void MapFederationGrantCheckEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/grants/check", Receive)
            .AllowAnonymous().RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);
        endpoints.MapPost("/api/platform/federation/peers/{instanceId:guid}/grants/outbound/{sourceSiteId:guid}/{destinationSiteId:guid}/verify", Verify)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"))
            .RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Receive(FederationGrantCheckRequest request, HttpContext context,
        IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS is required.");
        var now = DateTimeOffset.UtcNow;
        if (request.SchemaVersion != FederationGrantCheckProtocol.SchemaVersion ||
            request.SenderInstanceId == Guid.Empty || request.RecipientInstanceId == Guid.Empty ||
            request.Nonce == Guid.Empty || request.SourceSiteId == Guid.Empty || request.DestinationSiteId == Guid.Empty ||
            !Fresh(request.Timestamp, now))
            return Results.BadRequest(new { error = "invalid_grant_check" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId || request.SenderInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(value =>
            value.InstanceId == request.SenderInstanceId && value.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null || peer.LastProofAt is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _) ||
            !FederationProbeProtocol.Verify(peerKey,
                FederationGrantCheckProtocol.RequestBytes(request.SenderInstanceId, localId, request.Timestamp,
                    request.Nonce, request.SourceSiteId, request.DestinationSiteId), request.Signature))
            return Results.Unauthorized();
        var localKey = await db.FederationSigningIdentities.AsNoTracking()
            .SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (localKey is null) return Results.Problem(statusCode: 503, title: "The federation key is missing.");

        var grantRevision = await FederationSiteGrantPolicy.ActiveInboundRevisionAsync(peer.InstanceId,
            request.SourceSiteId, request.DestinationSiteId, db, ct);
        var allowed = grantRevision is > 0;
        var responseTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        string signature;
        try
        {
            using var key = FederationSigningKeys.Load(localKey, protection);
            signature = FederationProbeProtocol.Sign(key,
                FederationGrantCheckProtocol.ResponseBytes(localId, peer.InstanceId, responseTimestamp,
                    request.Nonce, request.SourceSiteId, request.DestinationSiteId, allowed, grantRevision));
        }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "The federation key cannot be used.");
        }
        db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "replayed_grant_check" });
        }
        return Results.Ok(new FederationGrantCheckResponse(FederationGrantCheckProtocol.SchemaVersion,
            localId, peer.InstanceId, responseTimestamp, request.Nonce, request.SourceSiteId,
            request.DestinationSiteId, allowed, grantRevision, signature));
    }

    private static async Task<IResult> Verify(Guid instanceId, Guid sourceSiteId, Guid destinationSiteId,
        ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
        IDataProtectionProvider protection, IHttpClientFactory clients, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
        if (peer is null) return Results.NotFound();
        if (!peer.IsActive || peer.LastProofAt is null || peer.PinnedPublicKeySpki is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _))
            return Results.Conflict(new { error = "federation_peer_not_proved" });
        var localSource = await db.Sites.AsNoTracking().AnyAsync(site =>
            site.Id == sourceSiteId && site.IsActive && site.ParentOrganizationUnitId == null, ct);
        var remoteDestination = await db.FederationRemoteSites.AsNoTracking().AnyAsync(value =>
            value.InstanceId == instanceId && value.SiteId == destinationSiteId && value.IsActive, ct);
        var localGrant = localSource && remoteDestination
            ? await db.FederationSiteGrants.AsNoTracking().Where(value =>
                value.PeerInstanceId == instanceId && value.LocalSiteId == sourceSiteId &&
                value.RemoteSiteId == destinationSiteId && value.Direction == "outbound" && value.IsActive)
                .Select(value => new { value.Id, value.Revision }).SingleOrDefaultAsync(ct)
            : null;
        if (localGrant is null) return Results.Conflict(new { error = "federation_local_grant_missing" });
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
                FederationGrantCheckProtocol.RequestBytes(localId, instanceId, timestamp, nonce,
                    sourceSiteId, destinationSiteId));
        }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "The federation key cannot be used.");
        }
        try
        {
            var target = new Uri(new Uri(peer.BaseUrl + "/"), "api/federation/v1/grants/check");
            using var outgoing = new HttpRequestMessage(HttpMethod.Post, target)
            {
                Content = JsonContent.Create(new FederationGrantCheckRequest(FederationGrantCheckProtocol.SchemaVersion,
                    localId, instanceId, timestamp, nonce, sourceSiteId, destinationSiteId, signature))
            };
            using var response = await clients.CreateClient("federation-probe")
                .SendAsync(outgoing, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
                return Results.Problem(statusCode: 502, title: "The peer rejected the site grant check.");
            await response.Content.LoadIntoBufferAsync(16_384, ct);
            var received = await response.Content.ReadFromJsonAsync<FederationGrantCheckResponse>(cancellationToken: ct);
            var now = DateTimeOffset.UtcNow;
            if (received is null || received.SchemaVersion != FederationGrantCheckProtocol.SchemaVersion ||
                received.SenderInstanceId != instanceId || received.RecipientInstanceId != localId ||
                received.Nonce != nonce || received.SourceSiteId != sourceSiteId ||
                received.DestinationSiteId != destinationSiteId || !Fresh(received.Timestamp, now) ||
                !FederationGrantCheckProtocol.ValidDecision(received.Allowed, received.GrantRevision) ||
                !FederationProbeProtocol.Verify(peerKey, FederationGrantCheckProtocol.ResponseBytes(instanceId,
                    localId, received.Timestamp, nonce, sourceSiteId, destinationSiteId,
                    received.Allowed, received.GrantRevision), received.Signature))
                return Results.Problem(statusCode: 502, title: "The peer's site grant could not be verified.");
            var audit = new AuditEvent(Guid.NewGuid(), null, actor, "federation-site-grant.verified",
                "federation-site-grant", localGrant.Id, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            var routingEnabled = await FederationRoutingPolicy.IsEnabledAsync(db, ct);
            return Results.Ok(new { peerInstanceId = instanceId, sourceSiteId, destinationSiteId,
                localGrantRevision = localGrant.Revision, remoteGrantRevision = received.GrantRevision,
                reciprocal = received.Allowed, routable = received.Allowed && routingEnabled });
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return Results.Problem(statusCode: 502, title: "The site grant could not be checked.");
        }
    }

    private static bool Fresh(long timestamp, DateTimeOffset now) =>
        timestamp >= now.ToUnixTimeSeconds() - 300 && timestamp <= now.ToUnixTimeSeconds() + 300;
}
