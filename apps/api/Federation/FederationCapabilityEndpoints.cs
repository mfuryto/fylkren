using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fylkren.Api.Federation;

internal static class FederationCapabilityEndpoints
{
    internal static void MapFederationCapabilityEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/federation/v1/capabilities", Receive)
            .AllowAnonymous()
            .RequireRateLimiting("federation-capability")
            .RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Receive(FederationCapabilityRequest request,
        HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db,
        CancellationToken ct)
    {
        if (!context.Request.IsHttps) return Results.Problem(statusCode: 400, title: "HTTPS kreves.");
        var now = DateTimeOffset.UtcNow;
        var nowSeconds = now.ToUnixTimeSeconds();
        if (request.Timestamp < nowSeconds - 300 || request.Timestamp > nowSeconds + 300)
            return Results.Conflict(new { error = "federation_clock_skew" });
        if (request.SenderInstanceId == Guid.Empty || request.RecipientInstanceId == Guid.Empty ||
            request.Nonce == Guid.Empty || !FederationCapabilityProtocol.ValidOffer(request))
            return Results.BadRequest(new { error = "invalid_capability_offer" });
        var localId = await db.InstanceIdentities.AsNoTracking().Where(row => row.Key == 1)
            .Select(row => row.InstanceId).SingleAsync(ct);
        if (request.RecipientInstanceId != localId || request.SenderInstanceId == localId)
            return Results.BadRequest(new { error = "invalid_recipient" });
        var peer = await db.FederationPeers.AsNoTracking().SingleOrDefaultAsync(row =>
            row.InstanceId == request.SenderInstanceId && row.IsActive &&
            row.LastProofAt != null, ct);
        if (peer?.PinnedPublicKeySpki is null ||
            !FederationPublicKey.TryParse(peer.PinnedPublicKeySpki, out var peerKey, out _) ||
            !FederationProbeProtocol.Verify(peerKey,
                FederationCapabilityProtocol.RequestBytes(request), request.Signature))
            return Results.Unauthorized();
        if (request.MinimumProtocolVersion > FederationCapabilityProtocol.ProtocolVersion ||
            request.MaximumProtocolVersion < FederationCapabilityProtocol.ProtocolVersion ||
            !request.WorkSchemaVersions.Contains(FederationWorkProtocol.SchemaVersion))
            return Results.Conflict(new { error = "federation_protocol_incompatible" });
        var messageTypes = FederationCapabilityProtocol.WorkMessageTypes
            .Intersect(request.WorkMessageTypes, StringComparer.Ordinal)
            .Order(StringComparer.Ordinal).ToArray();
        if (messageTypes.Length == 0)
            return Results.Conflict(new { error = "federation_protocol_incompatible" });
        var identity = await db.FederationSigningIdentities.AsNoTracking()
            .SingleOrDefaultAsync(row => row.Key == 1, ct);
        if (identity is null)
            return Results.Problem(statusCode: 503, title: "The federation key is missing.");
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var unsigned = new FederationCapabilityResponse(localId, peer.InstanceId,
            FederationCapabilityProtocol.ProtocolVersion, FederationWorkProtocol.SchemaVersion,
            messageTypes, timestamp, request.Nonce, string.Empty);
        using var key = FederationSigningKeys.Load(identity, protection);
        var response = unsigned with { Signature = FederationProbeProtocol.Sign(key,
            FederationCapabilityProtocol.ResponseBytes(unsigned)) };
        db.FederationProbeNonces.Add(new FederationProbeNonce(peer.InstanceId, request.Nonce, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "replayed_capability_offer" });
        }
        return Results.Ok(response);
    }
}
