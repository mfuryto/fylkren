using System.Security.Claims;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkRequestRecipientEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/request-recipients", async (Guid siteId, Guid? sourceUnitId, string? search, ClaimsPrincipal user, LicenseService license, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId) || !await WorkItemPolicy.CanLeadAnyLevel(siteId, personId, db, ct) && !await OrganizationAuthorization.CanPlanInSite(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var term = search?.Trim() ?? string.Empty;
            if (term.Length > RequestQueryPolicy.MaximumSearchLength) return Results.ValidationProblem(new Dictionary<string, string[]> { ["search"] = [$"The search cannot exceed {RequestQueryPolicy.MaximumSearchLength} characters."] });
            if (term.Length < 2) return Results.Ok(Array.Empty<object>());
            var instanceId = await db.InstanceIdentities.AsNoTracking().Where(x => x.Key == 1).Select(x => x.InstanceId).SingleAsync(ct);
            var pattern = RequestQueryPolicy.LikePattern(term);
            var eligibleSiteIds = await RequestRecipientPolicy.EligibleSiteIds(siteId, db, ct);
            var sites = await db.Sites.AsNoTracking()
                .Where(x => eligibleSiteIds.Contains(x.Id) && EF.Functions.ILike(x.Name, pattern, "\\"))
                .OrderBy(x => x.Name)
                .Take(25)
                .Select(x => new { x.Id, x.Name, kind = "site", instanceId })
                .ToListAsync(ct);
            var recipients = sites.Cast<object>().ToList();
            if (await FederationRoutingPolicy.IsEnabledAsync(db, ct) &&
                await license.Has(db, FeatureCatalog.InstanceFederation, ct))
            {
                var remaining = 25 - recipients.Count;
                if (remaining > 0)
                {
                    var sourceReady = await db.Sites.AsNoTracking().AnyAsync(site =>
                        site.Id == siteId && site.IsActive && site.ParentOrganizationUnitId == null, ct);
                    var remoteSites = await db.FederationRemoteSites.AsNoTracking()
                        .Where(remote => sourceReady && remote.IsActive &&
                            db.FederationPeers.Any(peer => peer.InstanceId == remote.InstanceId &&
                                peer.IsActive && peer.LastProofAt != null &&
                                peer.PinnedPublicKeySpki != null) &&
                            EF.Functions.ILike(remote.Name, pattern, "\\"))
                        .OrderBy(remote => remote.Name)
                        .Take(remaining)
                        .Select(remote => new { Id = remote.SiteId, remote.Name, kind = "site",
                            instanceId = remote.InstanceId })
                        .ToListAsync(ct);
                    recipients.AddRange(remoteSites);
                }
            }
            if (sourceUnitId is null) return Results.Ok(recipients);
            if (!await db.OrganizationUnits.AnyAsync(x => x.Id == sourceUnitId && x.SiteId == siteId && x.IsActive, ct) || !await WorkLevelAuthorization.LeadsLevel(siteId, sourceUnitId.Value, personId, db, ct)) return Results.Problem(statusCode: 403);
            var units = await db.OrganizationUnits.AsNoTracking()
                .Where(x => x.SiteId == siteId && x.IsActive && !x.IsSiteRoot && !x.IsSiteLeadership && x.Id != sourceUnitId && EF.Functions.ILike(x.Name, pattern, "\\"))
                .OrderBy(x => x.Name).Take(25)
                .Select(x => new { x.Id, x.Name, kind = "unit", instanceId }).ToListAsync(ct);
            return Results.Ok(recipients.Concat(units).Take(25));
        });
    }
}
