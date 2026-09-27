using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkloadQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/descendant-workload", async (Guid siteId, Guid? unitId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId) ||
                (unitId is Guid selectedUnitId
                    ? !await WorkItemPolicy.LeadsUnit(siteId, selectedUnitId, personId, db, ct)
                    : !await WorkItemPolicy.HasTopLevelAccess(siteId, personId, db, ct)))
                return Results.Problem(statusCode: 403);
            var links = await db.Sites.AsNoTracking().Where(x => x.IsActive && x.ParentOrganizationUnit != null)
                .Select(x => new SiteLink(x.Id, x.ParentOrganizationUnit!.SiteId, x.ParentOrganizationUnitId!.Value)).ToListAsync(ct);
            var units = await db.OrganizationUnits.AsNoTracking()
                .Where(x => x.SiteId == siteId && x.IsActive)
                .Select(x => new UnitNode(x.Id, x.ParentId, x.IsSiteRoot, x.IsSiteLeadership)).ToListAsync(ct);
            var topLevelIds = units.Where(x => x.IsSiteRoot || x.IsSiteLeadership).Select(x => x.Id).ToHashSet();
            var levelUnitIds = unitId is Guid levelUnitId ? UnitSubtree(levelUnitId, units) : units.Select(x => x.Id).ToHashSet();
            var directUnits = unitId is Guid parentUnitId
                ? units.Where(x => !x.IsSiteRoot && !x.IsSiteLeadership && x.ParentId == parentUnitId).ToList()
                : units.Where(x => !x.IsSiteRoot && !x.IsSiteLeadership && x.ParentId != null && topLevelIds.Contains(x.ParentId.Value)).ToList();
            var directChildSites = links.Where(x => x.ParentSiteId == siteId &&
                (unitId is Guid selectedParentUnitId ? x.ParentUnitId == selectedParentUnitId : topLevelIds.Contains(x.ParentUnitId))).ToList();
            var descendantSites = SiteDescendants(links.Where(x => x.ParentSiteId == siteId && levelUnitIds.Contains(x.ParentUnitId)).Select(x => x.Id), links);
            var terminalStatuses = new[] { "completed", "rejected", "cancelled", "reassigned" };
            var rows = await db.WorkItems.AsNoTracking().Where(x =>
                    !terminalStatuses.Contains(x.Status) &&
                    (x.SiteId == siteId && (unitId == null || x.AssignedUnitId != null && levelUnitIds.Contains(x.AssignedUnitId.Value)) ||
                     descendantSites.Contains(x.SiteId)))
                .Select(x => new { x.Id, x.SiteId, x.ParentWorkItemId, x.AssignedUnitId, x.Status, x.DueAt }).ToListAsync(ct);
            var activeParentIds = rows.Where(x => x.ParentWorkItemId != null).Select(x => x.ParentWorkItemId!.Value).ToHashSet();
            var leaves = rows.Where(x => !activeParentIds.Contains(x.Id)).ToList(); var now = DateTimeOffset.UtcNow;
            var unitSummaries = directUnits.Select(unit =>
            {
                var subtree = UnitSubtree(unit.Id, units);
                var attachedSites = SiteDescendants(links.Where(x => x.ParentSiteId == siteId && subtree.Contains(x.ParentUnitId)).Select(x => x.Id), links);
                var unitLeaves = leaves.Where(x =>
                    x.SiteId == siteId && x.AssignedUnitId != null && subtree.Contains(x.AssignedUnitId.Value) || attachedSites.Contains(x.SiteId)).ToList();
                return new
                {
                    unitId = unit.Id,
                    active = unitLeaves.Count,
                    underway = unitLeaves.Count(x => x.Status is "execution" or "in_progress"),
                    statusCounts = unitLeaves.GroupBy(x => x.Status).Select(group => new { status = group.Key, count = group.Count() }).ToList()
                };
            }).ToList();
            var siteSummaries = directChildSites.Select(childSite =>
            {
                var subtree = SiteDescendants([childSite.Id], links);
                var siteLeaves = leaves.Where(x => subtree.Contains(x.SiteId)).ToList();
                return new
                {
                    siteId = childSite.Id,
                    active = siteLeaves.Count,
                    underway = siteLeaves.Count(x => x.Status is "execution" or "in_progress"),
                    statusCounts = siteLeaves.GroupBy(x => x.Status).Select(group => new { status = group.Key, count = group.Count() }).ToList()
                };
            }).ToList();
            return Results.Ok(new
            {
                active = leaves.Count,
                nearDeadline = leaves.Count(x => x.DueAt >= now && x.DueAt <= now.AddDays(7)),
                overdue = leaves.Count(x => x.DueAt < now),
                unitSummaries,
                siteSummaries
            });
        });
        group.MapGet("/sites/{siteId:guid}/workload-history", async (Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId) || !await WorkItemPolicy.HasTopLevelAccess(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var siteLinks = await db.Sites.AsNoTracking().Where(x => x.IsActive && x.ParentOrganizationUnit != null)
                .Select(x => new { x.Id, x.Name, ParentSiteId = x.ParentOrganizationUnit!.SiteId }).ToListAsync(ct);
            var siteIds = new HashSet<Guid> { siteId }; var changed = true;
            while (changed) { changed = false; foreach (var link in siteLinks.Where(x => siteIds.Contains(x.ParentSiteId))) changed |= siteIds.Add(link.Id); }
            var units = await db.OrganizationUnits.AsNoTracking().Where(x => siteIds.Contains(x.SiteId) && x.IsActive)
                .Select(x => new { x.Id, x.SiteId, x.ParentId, x.Name, x.IsSiteRoot, x.IsSiteLeadership, x.SortOrder }).ToListAsync(ct);
            var rootId = units.Where(x => x.SiteId == siteId && x.IsSiteRoot).Select(x => x.Id).Single();
            var directUnits = units.Where(x => x.SiteId == siteId && x.ParentId == rootId && !x.IsSiteLeadership).OrderBy(x => x.SortOrder).ThenBy(x => x.Name).ToList();
            var directChildSites = siteLinks.Where(x => x.ParentSiteId == siteId).OrderBy(x => x.Name).ToList();
            var terminal = new HashSet<string>(["completed", "rejected", "cancelled", "reassigned"]);
            var currentMonth = new DateTimeOffset(DateTime.UtcNow.Year, DateTime.UtcNow.Month, 1, 0, 0, 0, TimeSpan.Zero);
            var periodStart = currentMonth.AddMonths(-11);
            var periodEnd = currentMonth.AddMonths(1);
            var availableFrom = await db.WorkItemStateHistory.AsNoTracking().Where(x => siteIds.Contains(x.SiteId))
                .Select(x => (DateTimeOffset?)x.OccurredAt).MinAsync(ct);
            var baseline = await db.WorkItemStateHistory.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId) && x.OccurredAt < periodStart)
                .GroupBy(x => x.WorkItemId)
                .Select(group => group.OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id).First())
                .ToListAsync(ct);
            var periodHistory = await db.WorkItemStateHistory.AsNoTracking()
                .Where(x => siteIds.Contains(x.SiteId) && x.OccurredAt >= periodStart && x.OccurredAt < periodEnd)
                .OrderBy(x => x.OccurredAt).ThenBy(x => x.Id)
                .ToListAsync(ct);
            var history = baseline.Where(x => !terminal.Contains(x.Status)).Concat(periodHistory)
                .OrderBy(x => x.OccurredAt).ThenBy(x => x.Id).ToList();
            var historyItemIds = history.Select(x => x.WorkItemId).Distinct().ToList();
            var itemRows = await db.WorkItems.AsNoTracking().Where(x => historyItemIds.Contains(x.Id))
                .Select(x => new { x.Id, x.ParentWorkItemId }).ToListAsync(ct);
            var points = Enumerable.Range(0, 12).Select(offset => currentMonth.AddMonths(offset - 11).AddMonths(1).AddTicks(-1)).Select(pointAt =>
            {
                var states = history.Where(x => x.OccurredAt <= pointAt).GroupBy(x => x.WorkItemId).Select(group => group.Last()).Where(x => !terminal.Contains(x.Status)).ToList();
                var activeIds = states.Select(x => x.WorkItemId).ToHashSet();
                var activeParentIds = itemRows.Where(x => x.ParentWorkItemId != null && activeIds.Contains(x.Id)).Select(x => x.ParentWorkItemId!.Value).ToHashSet();
                var leaves = states.Where(x => !activeParentIds.Contains(x.WorkItemId)).ToList();
                bool UnitWithin(Guid? assignedUnitId, Guid directUnitId)
                {
                    var cursor = assignedUnitId;
                    while (cursor != null) { if (cursor == directUnitId) return true; cursor = units.FirstOrDefault(x => x.Id == cursor)?.ParentId; }
                    return false;
                }
                bool SiteWithin(Guid candidate, Guid childSiteId)
                {
                    var cursor = candidate;
                    while (cursor != siteId) { if (cursor == childSiteId) return true; var parent = siteLinks.FirstOrDefault(x => x.Id == cursor); if (parent == null) return false; cursor = parent.ParentSiteId; }
                    return false;
                }
                var series = directUnits.Select(unit => new { key = unit.Id, unit.Name, kind = "unit", count = leaves.Count(x => x.SiteId == siteId && UnitWithin(x.AssignedUnitId, unit.Id)) })
                    .Cast<object>().Concat(directChildSites.Select(site => new { key = site.Id, site.Name, kind = "site", count = leaves.Count(x => SiteWithin(x.SiteId, site.Id)) })).ToList();
                return new { at = pointAt, total = leaves.Count, series };
            }).ToList();
            return Results.Ok(new { availableFrom, points });
        });
    }

    private static HashSet<Guid> UnitSubtree(Guid rootId, IReadOnlyCollection<UnitNode> units)
    {
        var subtree = new HashSet<Guid> { rootId }; var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var node in units.Where(node => node.ParentId is Guid parentId && subtree.Contains(parentId)))
                changed |= subtree.Add(node.Id);
        }
        return subtree;
    }

    private static HashSet<Guid> SiteDescendants(IEnumerable<Guid> roots, IReadOnlyCollection<SiteLink> links)
    {
        var subtree = roots.ToHashSet(); var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var node in links.Where(node => subtree.Contains(node.ParentSiteId)))
                changed |= subtree.Add(node.Id);
        }
        return subtree;
    }

    private sealed record UnitNode(Guid Id, Guid? ParentId, bool IsSiteRoot, bool IsSiteLeadership);
    private sealed record SiteLink(Guid Id, Guid ParentSiteId, Guid ParentUnitId);
}
