using System.Security.Claims;
using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationRoutingEndpoints
{
    internal static void MapFederationRoutingEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/federation/routing")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("", Get);
        group.MapPut("", Update).RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private static async Task<IResult> Get(HttpContext context, IConfiguration configuration,
        FylkrenOptions options, IDataProtectionProvider protection, LicenseService license,
        FylkrenDbContext db, CancellationToken ct)
    {
        var state = await State(context, configuration, options, protection, license, db, ct);
        return Results.Ok(state);
    }

    private static async Task<IResult> Update(RoutingRequest request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, IConfiguration configuration,
        FylkrenOptions options, IDataProtectionProvider protection, LicenseService license,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
        var state = await State(context, configuration, options, protection, license, db, ct);
        if (request.Enabled && state.Blockers.Length > 0)
            return Results.Conflict(new { error = "federation_routing_not_ready", blockers = state.Blockers });

        var settings = await db.FederationRoutingSettings
            .SingleAsync(value => value.Key == FederationRoutingSettings.SingletonKey, ct);
        if (settings.Enabled != request.Enabled)
        {
            var now = DateTimeOffset.UtcNow;
            settings.SetEnabled(request.Enabled, actor, now);
            var instanceId = await db.InstanceIdentities.AsNoTracking()
                .Where(value => value.Key == 1).Select(value => value.InstanceId).SingleAsync(ct);
            var audit = new AuditEvent(Guid.NewGuid(), null, actor,
                request.Enabled ? "federation-routing.enabled" : "federation-routing.disabled",
                "federation-routing", instanceId, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
        }
        return Results.Ok(await State(context, configuration, options, protection, license, db, ct));
    }

    private static async Task<RoutingState> State(HttpContext context, IConfiguration configuration,
        FylkrenOptions options, IDataProtectionProvider protection, LicenseService license,
        FylkrenDbContext db, CancellationToken ct)
    {
        var settings = await db.FederationRoutingSettings.AsNoTracking()
            .SingleAsync(value => value.Key == FederationRoutingSettings.SingletonKey, ct);
        var blockers = new List<string>();
        if (!context.Request.IsHttps ||
            !options.PublicUrl.StartsWith("https://", StringComparison.OrdinalIgnoreCase) ||
            !configuration.GetValue<bool>("Fylkren:Http:RequireHttps") ||
            !configuration.GetValue<bool>("Fylkren:Http:TrustForwardedHeaders"))
            blockers.Add("secure_https_configuration_required");
        if (!await license.Has(db, FeatureCatalog.InstanceFederation, ct))
            blockers.Add("enterprise_license_required");
        var identity = await db.FederationSigningIdentities.AsNoTracking()
            .SingleOrDefaultAsync(value => value.Key == 1, ct);
        if (identity is null)
            blockers.Add("federation_identity_required");
        else
        {
            try { using var unused = FederationSigningKeys.Load(identity, protection); }
            catch (CryptographicException) { blockers.Add("usable_federation_key_required"); }
        }
        if (!await db.FederationPeers.AsNoTracking().AnyAsync(value =>
                value.IsActive && value.PinnedPublicKeySpki != null && value.LastProofAt != null, ct))
            blockers.Add("proved_peer_required");
        return new RoutingState(settings.Enabled, blockers.Count == 0, blockers.ToArray(),
            settings.ChangedAt, settings.ChangedBy);
    }

    private sealed record RoutingRequest(bool Enabled);
    private sealed record RoutingState(bool Enabled, bool ReadyToEnable, string[] Blockers,
        DateTimeOffset ChangedAt, Guid? ChangedBy);
}
