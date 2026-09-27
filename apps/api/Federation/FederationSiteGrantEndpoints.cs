using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationSiteGrantEndpoints
{
    internal static void MapFederationSiteGrantEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/federation/peers/{instanceId:guid}/grants")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapGet("", async (Guid instanceId, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await db.FederationPeers.AnyAsync(peer => peer.InstanceId == instanceId, ct))
                return Results.NotFound();
            var grants = await db.FederationSiteGrants.AsNoTracking()
                .Where(grant => grant.PeerInstanceId == instanceId)
                .OrderBy(grant => grant.LocalSiteId).ThenBy(grant => grant.RemoteSiteId)
                .Select(grant => new { grant.Id, grant.LocalSiteId, grant.RemoteSiteId, grant.Direction,
                    grant.IsActive, grant.Revision, grant.CreatedAt, grant.UpdatedAt })
                .ToListAsync(ct);
            return Results.Ok(grants);
        });

        group.MapPut("/{direction}/{localSiteId:guid}/{remoteSiteId:guid}", async (
            Guid instanceId, string direction, Guid localSiteId, Guid remoteSiteId, GrantRequest request,
            ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            if (direction is not ("inbound" or "outbound"))
                return Results.ValidationProblem(new Dictionary<string, string[]> {
                    ["direction"] = ["Velg inbound eller outbound."] });
            var peer = await db.FederationPeers.AsNoTracking()
                .SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
            if (peer is null) return Results.NotFound();
            var grant = await db.FederationSiteGrants.SingleOrDefaultAsync(value =>
                value.PeerInstanceId == instanceId && value.LocalSiteId == localSiteId &&
                value.RemoteSiteId == remoteSiteId && value.Direction == direction, ct);
            if (!request.IsActive && grant is null) return Results.NoContent();
            if (request.IsActive)
            {
                if (!peer.IsActive || peer.LastProofAt is null)
                    return Results.Conflict(new { error = "federation_peer_not_proved" });
                var local = await db.Sites.AsNoTracking().SingleOrDefaultAsync(site => site.Id == localSiteId, ct);
                if (local is null || !local.IsActive || local.ParentOrganizationUnitId is not null)
                    return Results.Conflict(new { error = "federation_top_level_site_required" });
                var remote = await db.FederationRemoteSites.AsNoTracking().SingleOrDefaultAsync(site =>
                    site.InstanceId == instanceId && site.SiteId == remoteSiteId, ct);
                if (remote is null || !remote.IsActive)
                    return Results.Conflict(new { error = "federation_remote_site_unavailable" });
            }
            if (grant?.IsActive == request.IsActive)
                return Results.Ok(new { grant.Id, grant.IsActive, grant.Revision, routable = false });
            var now = DateTimeOffset.UtcNow;
            if (grant is null)
            {
                grant = new FederationSiteGrant(Guid.NewGuid(), instanceId, localSiteId, remoteSiteId, direction, now);
                db.FederationSiteGrants.Add(grant);
            }
            else grant.SetActive(request.IsActive, now);
            var audit = new AuditEvent(Guid.NewGuid(), null, actor,
                request.IsActive ? "federation-site-grant.activated" : "federation-site-grant.revoked",
                "federation-site-grant", grant.Id, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { grant.Id, grant.LocalSiteId, grant.RemoteSiteId, grant.Direction,
                grant.IsActive, grant.Revision, routable = false });
        }).RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private sealed record GrantRequest(bool IsActive);
}
