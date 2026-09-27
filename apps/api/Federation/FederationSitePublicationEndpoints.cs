using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationSitePublicationEndpoints
{
    internal static void MapFederationSitePublicationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/federation/peers/{instanceId:guid}/sites")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapGet("", async (Guid instanceId, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await db.FederationPeers.AnyAsync(peer => peer.InstanceId == instanceId, ct))
                return Results.NotFound();
            var rows = await db.FederationSitePublications.AsNoTracking()
                .Where(publication => publication.PeerInstanceId == instanceId)
                .Join(db.Sites.AsNoTracking(), publication => publication.LocalSiteId, site => site.Id,
                    (publication, site) => new
                    {
                        siteId = site.Id, siteName = site.Name, siteIsActive = site.IsActive,
                        isTopLevelSite = site.ParentOrganizationUnitId == null,
                        publication.IsActive, publication.Revision, publication.CreatedAt, publication.UpdatedAt
                    })
                .OrderBy(row => row.siteName).ToListAsync(ct);
            return Results.Ok(rows);
        });

        group.MapPut("/{siteId:guid}", async (Guid instanceId, Guid siteId, PublicationRequest request,
            ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Forbid();
            if (!await db.FederationPeers.AnyAsync(peer => peer.InstanceId == instanceId && peer.IsActive, ct))
                return Results.NotFound();
            var site = await db.Sites.AsNoTracking().SingleOrDefaultAsync(value => value.Id == siteId, ct);
            if (site is null) return Results.NotFound();
            if (request.IsActive && !site.IsActive)
                return Results.Conflict(new { error = "federation_site_inactive" });
            if (request.IsActive && site.ParentOrganizationUnitId is not null)
                return Results.Conflict(new { error = "federation_top_level_site_required" });
            var publication = await db.FederationSitePublications.SingleOrDefaultAsync(value =>
                value.PeerInstanceId == instanceId && value.LocalSiteId == siteId, ct);
            var now = DateTimeOffset.UtcNow;
            if (publication is null)
            {
                if (!request.IsActive) return Results.NoContent();
                publication = new FederationSitePublication(instanceId, siteId, now);
                db.FederationSitePublications.Add(publication);
            }
            else if (publication.IsActive == request.IsActive)
                return Results.Ok(new { publication.LocalSiteId, publication.IsActive, publication.Revision });
            else publication.SetActive(request.IsActive, now);
            if (!request.IsActive)
                await FederationSiteGrantPolicy.SuspendPublicationAsync(instanceId, siteId, db, now, ct);
            var audit = new AuditEvent(Guid.NewGuid(), null, actor,
                request.IsActive ? "federation-site.published" : "federation-site.unpublished",
                "federation-site-publication", siteId, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { publication.LocalSiteId, publication.IsActive, publication.Revision });
        }).RequireFeature(FeatureCatalog.InstanceFederation);
    }

    private sealed record PublicationRequest(bool IsActive);
}
