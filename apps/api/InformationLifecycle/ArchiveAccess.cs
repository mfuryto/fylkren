using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal static class ArchiveAccess
{
    internal static IQueryable<ArchiveGrant> Current(FylkrenDbContext db, Guid personId) => db.ArchiveGrants.AsNoTracking().Where(g =>
        g.PersonId == personId && g.IsActive && db.People.Any(p => p.Id == personId && p.IsActive && !p.IsDeleted) &&
        db.InformationLifecycles.Any(l => l.OwnerSiteId == g.SiteId && l.ResourceType == "site" && l.ResourceId == g.SiteId && (l.Stage == "closed" || l.Stage == "archived")));
    internal static Task<bool> CanRead(Guid siteId, Guid personId, FylkrenDbContext db, CancellationToken ct) => Current(db, personId).AnyAsync(g => g.SiteId == siteId, ct);
    internal static Task<bool> CanExport(Guid siteId, Guid personId, FylkrenDbContext db, CancellationToken ct) => Current(db, personId).AnyAsync(g => g.SiteId == siteId && g.CanExport, ct);
}
