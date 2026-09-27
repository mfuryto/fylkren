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

internal static class FederationProbeEndpoints
{
    internal static void MapFederationProbeEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/probe", Receive)
            .AllowAnonymous()
            .RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);

        endpoints.MapPost("/api/platform/federation/peers/{instanceId:guid}/probe", Send)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"))
            .RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Receive(FederationProbeRequest request, HttpContext context,
        IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS kreves.");
        var now = DateTimeOffset.UtcNow;
        var nowSeconds = now.ToUnixTimeSeconds();
        if (request.SenderInstanceId == Guid.Empty || request.RecipientInstanceId == Guid.Empty ||
            request.Nonce == Guid.Empty || request.Timestamp < nowSeconds - 300 || request.Timestamp > nowSeconds + 300)
            return Results.BadRequest(new { error = "invalid_probe" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId || request.SenderInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(
            value => value.InstanceId == request.SenderInstanceId && value.IsActive, ct);
        if (peer?.PinnedPublicKeySpki is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _) ||
            !FederationProbeProtocol.Verify(peerKey,
                FederationProbeProtocol.RequestBytes(request.SenderInstanceId, localId, request.Timestamp, request.Nonce),
                request.Signature))
            return Results.Unauthorized();

        var localKey = await db.FederationSigningIdentities.AsNoTracking().SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (localKey is null) return Results.Problem(statusCode: 503, title: "Federeringsnøkkel mangler.");
        var responseTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        string signature;
        try
        {
            using var signingKey = FederationSigningKeys.Load(localKey, protection);
            signature = FederationProbeProtocol.Sign(signingKey,
                FederationProbeProtocol.ResponseBytes(localId, request.SenderInstanceId, responseTimestamp, request.Nonce));
        }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "Federeringsnøkkelen kan ikke brukes.");
        }
        db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "replayed_probe" });
        }
        return Results.Ok(new FederationProbeResponse(localId, request.SenderInstanceId, responseTimestamp, request.Nonce, signature));
    }

    private static async Task<IResult> Send(Guid instanceId, ClaimsPrincipal user, IAntiforgery antiforgery,
        HttpContext context, IDataProtectionProvider protection, IHttpClientFactory clients,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
        var peer = await db.FederationPeers.SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
        if (peer is null) return Results.NotFound();
        if (!peer.IsActive || peer.PinnedPublicKeySpki is null)
            return Results.Conflict(new { error = "federation_peer_not_ready" });
        var localKey = await db.FederationSigningIdentities.AsNoTracking().SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (localKey is null) return Results.Conflict(new { error = "federation_identity_missing" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var nonce = Guid.NewGuid();
        string signature;
        try
        {
            using var key = FederationSigningKeys.Load(localKey, protection);
            signature = FederationProbeProtocol.Sign(key,
                FederationProbeProtocol.RequestBytes(localId, instanceId, timestamp, nonce));
        }
        catch (CryptographicException)
        {
            return Results.Problem(statusCode: 503, title: "Federeringsnøkkelen kan ikke brukes.");
        }
        if (!FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out var fingerprint))
            return Results.Conflict(new { error = "federation_peer_key_invalid" });
        var target = new Uri(new Uri(peer.BaseUrl + "/"), "api/federation/v1/probe");
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, target)
            {
                Content = JsonContent.Create(new FederationProbeRequest(localId, instanceId, timestamp, nonce, signature))
            };
            using var response = await clients.CreateClient("federation-probe").SendAsync(
                request, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
                return Results.Problem(statusCode: 502, title: "Motparten avviste prøvekoblingen.");
            await response.Content.LoadIntoBufferAsync(16_384, ct);
            var received = await response.Content.ReadFromJsonAsync<FederationProbeResponse>(cancellationToken: ct);
            var now = DateTimeOffset.UtcNow;
            if (received is null || received.SenderInstanceId != instanceId ||
                received.RecipientInstanceId != localId || received.Nonce != nonce ||
                received.Timestamp < now.ToUnixTimeSeconds() - 300 ||
                received.Timestamp > now.ToUnixTimeSeconds() + 300 ||
                !FederationProbeProtocol.Verify(peerKey,
                    FederationProbeProtocol.ResponseBytes(instanceId, localId, received.Timestamp, nonce),
                    received.Signature))
                return Results.Problem(statusCode: 502, title: "Motpartens signatur kunne ikke bekreftes.");
            peer.RecordProof(now);
            var audit = new AuditEvent(Guid.NewGuid(), null, actor, "federation-peer.proved", "federation-peer", instanceId, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            try { await db.SaveChangesAsync(ct); }
            catch (DbUpdateConcurrencyException)
            {
                return Results.Conflict(new { error = "federation_peer_state_changed" });
            }
            return Results.Ok(new { peer.InstanceId, verifiedAt = now, fingerprint, routable = false });
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or System.Text.Json.JsonException)
        {
            return Results.Problem(statusCode: 502, title: "Prøvekoblingen kunne ikke fullføres.");
        }
    }

}
