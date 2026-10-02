using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Learning;

internal static class LearningPolicy
{
    internal sealed record Level(Guid SiteId, string SiteName, Guid UnitId, string UnitName, bool CanManage);
    internal static async Task<IReadOnlyList<Level>> Levels(Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var sites = await db.SiteMemberships.AsNoTracking().Where(value => value.PersonId == personId && value.IsActive && value.Person.IsActive && value.Site.IsActive)
            .Select(value => new { value.SiteId, value.Site.Name }).Distinct().OrderBy(value => value.Name).ToListAsync(ct);
        var result = new List<Level>();
        foreach (var site in sites)
        {
            var units = await db.OrganizationUnits.AsNoTracking().Where(value => value.SiteId == site.SiteId && value.IsActive && !value.IsSiteRoot)
                .OrderBy(value => value.Name).Select(value => new { value.Id, value.Name, value.IsSiteLeadership }).ToListAsync(ct);
            var access = await WorkLevelAuthorization.AccessForLevels(site.SiteId, units.Select(value => value.IsSiteLeadership ? null : (Guid?)value.Id), personId, db, ct);
            foreach (var level in access.Where(value => value.Belongs || value.Leads))
            {
                var unit = units.Single(value => level.LevelId is null ? value.IsSiteLeadership : value.Id == level.LevelId);
                result.Add(new Level(site.SiteId, site.Name, unit.Id, unit.Name, level.Leads));
            }
        }
        return result;
    }
    internal static async Task<int> PendingCount(Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var levels = (await Levels(personId, db, ct)).Where(value => value.CanManage).Select(value => value.UnitId).ToArray();
        return await db.LearningLessons.CountAsync(value => levels.Contains(value.UnitId) && (value.Status == "new" || value.Status == "in_progress"), ct);
    }
}
