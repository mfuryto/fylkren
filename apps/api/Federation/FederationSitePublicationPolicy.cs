using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationSitePublicationPolicy
{
    // A site ceases to be a federated top-level destination when it is attached
    // below another site or deactivated. Restoring it to root does not republish it.
    internal static async Task SuspendAsync(Guid siteId, FylkrenDbContext db, DateTimeOffset at, CancellationToken ct)
    {
        var active = await db.FederationSitePublications
            .Where(value => value.LocalSiteId == siteId && value.IsActive)
            .ToListAsync(ct);
        foreach (var publication in active) publication.SetActive(false, at);
        await FederationSiteGrantPolicy.SuspendLocalAsync(siteId, db, at, ct);
    }

    internal static async Task RefreshAsync(Guid siteId, FylkrenDbContext db, DateTimeOffset at, CancellationToken ct)
    {
        var active = await db.FederationSitePublications
            .Where(value => value.LocalSiteId == siteId && value.IsActive)
            .ToListAsync(ct);
        foreach (var publication in active) publication.Refresh(at);
    }
}
