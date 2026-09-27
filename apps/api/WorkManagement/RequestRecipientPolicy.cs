using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class RequestRecipientPolicy
{
    public static async Task<HashSet<Guid>> EligibleSiteIds(
        Guid sourceSiteId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var sites = await database.Sites.AsNoTracking()
            .Where(site => site.IsActive)
            .Select(site => new
            {
                site.Id,
                ParentSiteId = site.ParentOrganizationUnit == null
                    ? (Guid?)null
                    : site.ParentOrganizationUnit.SiteId
            })
            .ToListAsync(cancellationToken);

        var excluded = new HashSet<Guid> { sourceSiteId };
        var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var site in sites.Where(site => site.ParentSiteId is Guid parentSiteId && excluded.Contains(parentSiteId)))
                changed |= excluded.Add(site.Id);
        }

        return sites.Where(site => !excluded.Contains(site.Id)).Select(site => site.Id).ToHashSet();
    }
}
