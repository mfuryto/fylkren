using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationIdentityDiscoveryEndpoints
{
    internal static void MapFederationIdentityDiscoveryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/identity/discover", Receive)
            .AllowAnonymous()
            .RequireRateLimiting("federation-probe")
            .RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Receive(FederationIdentityDiscoveryRequest request,
        HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db,
        CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS kreves.");
        if (request.RequesterInstanceId == Guid.Empty || request.Nonce == Guid.Empty)
            return Results.BadRequest(new { error = "invalid_identity_discovery" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        if (request.RequesterInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_identity_discovery_requester" });
        var identity = await db.FederationSigningIdentities.AsNoTracking()
            .SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (identity is null)
            return Results.Problem(statusCode: 503, title: "Federeringsnøkkel mangler.");
        if (!FederationPublicKey.TryParse(identity.PublicKeySpki, out _, out var fingerprint))
            return Results.Problem(statusCode: 503, title: "Federeringsnøkkelen er ugyldig.");
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        using var key = FederationSigningKeys.Load(identity, protection);
        var signature = FederationProbeProtocol.Sign(key,
            FederationIdentityDiscoveryProtocol.ResponseBytes(localId,
                request.RequesterInstanceId, timestamp, request.Nonce, fingerprint));
        return Results.Ok(new FederationIdentityDiscoveryResponse(localId,
            request.RequesterInstanceId, timestamp, request.Nonce,
            identity.PublicKeySpki, signature));
    }
}
