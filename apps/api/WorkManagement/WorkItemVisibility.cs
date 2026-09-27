using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemVisibility
{
    internal static async Task<IQueryable<WorkItem>> QueryForPerson(
        Guid siteId,
        Guid personId,
        DateTimeOffset now,
        FylkrenDbContext db,
        CancellationToken ct)
    {
        if (await HasTopLevelAccess(siteId, personId, db, ct))
        {
            return await TopLevelQuery(siteId, db, ct);
        }

        var directlyAccessibleIds = await DirectlyAccessibleQuery(siteId, personId, now, db)
            .Select(item => item.Id)
            .ToListAsync(ct);
        var hierarchy = (await db.WorkItems
                .AsNoTracking()
                .Where(item => item.SiteId == siteId)
                .Select(item => new WorkTreeNode(item.Id, item.ParentWorkItemId))
                .ToListAsync(ct))
            .ToDictionary(item => item.Id);
        var visibleIds = IncludeAncestors(directlyAccessibleIds, hierarchy);

        return db.WorkItems.AsNoTracking().Where(item => visibleIds.Contains(item.Id));
    }

    private static async Task<IQueryable<WorkItem>> TopLevelQuery(
        Guid siteId,
        FylkrenDbContext db,
        CancellationToken ct)
    {
        var topLevelRootIds = await db.WorkItems.AsNoTracking()
            .Where(item => item.SiteId == siteId &&
                (item.ParentWorkItemId == null || item.ParentWorkItem != null && item.ParentWorkItem.SiteId != siteId) &&
                (item.AssignedUnitId == null || item.AssignedUnit != null &&
                    (item.AssignedUnit.IsSiteLeadership ||
                     item.AssignedUnit.WorksAtParentLevel && item.AssignedUnit.Parent != null &&
                     (item.AssignedUnit.Parent.IsSiteLeadership || item.AssignedUnit.Parent.IsSiteRoot))))
            .Select(item => item.Id)
            .ToListAsync(ct);
        var localHierarchy = await db.WorkItems.AsNoTracking()
            .Where(item => item.SiteId == siteId)
            .Select(item => new WorkTreeNode(item.Id,
                item.ParentWorkItem != null && item.ParentWorkItem.SiteId == siteId ? item.ParentWorkItemId : null))
            .ToListAsync(ct);
        var visibleLocalIds = IncludeDescendants(topLevelRootIds, localHierarchy);

        return db.WorkItems.AsNoTracking().Where(item =>
            item.SiteId == siteId && visibleLocalIds.Contains(item.Id) ||
            item.SiteId != siteId && item.ParentWorkItemId != null && visibleLocalIds.Contains(item.ParentWorkItemId.Value) &&
            item.ParentWorkItem != null && item.ParentWorkItem.SiteId == siteId &&
            !(item.ParentWorkItem.WorkItemType != null &&
              item.ParentWorkItem.WorkItemType.IsSystemManaged &&
              item.ParentWorkItem.WorkItemType.NormalizedName == "ANMODNING"));
    }

    private static IQueryable<WorkItem> DirectlyAccessibleQuery(
        Guid siteId,
        Guid personId,
        DateTimeOffset now,
        FylkrenDbContext db) =>
        db.WorkItems.AsNoTracking().Where(item =>
            item.SiteId == siteId &&
            (item.CreatedByPersonId == personId ||
             db.OrganizationUnitMemberships.Any(membership =>
                 membership.SiteId == siteId &&
                 membership.PersonId == personId &&
                 membership.OrganizationUnit.IsActive &&
                 membership.OrganizationUnit.WorksAtParentLevel &&
                 (item.AssignedUnitId == null
                     ? membership.OrganizationUnit.Parent != null &&
                       (membership.OrganizationUnit.Parent.IsSiteLeadership || membership.OrganizationUnit.Parent.IsSiteRoot)
                     : membership.OrganizationUnit.ParentId == item.AssignedUnitId)) ||
             item.AssignedUnit != null && item.AssignedUnit.Roles.Any(role => role.Assignments.Any(assignment =>
                 assignment.PersonId == personId &&
                 assignment.IsActive &&
                 assignment.ValidFrom <= now &&
                 (assignment.ValidTo == null || assignment.ValidTo > now))) ||
             item.ParentWorkItem != null &&
             item.ParentWorkItem.AssignedUnit != null &&
             item.ParentWorkItem.AssignedUnit.Roles.Any(role => role.Assignments.Any(assignment =>
                 assignment.PersonId == personId &&
                 assignment.IsActive &&
                 assignment.ValidFrom <= now &&
                 (assignment.ValidTo == null || assignment.ValidTo > now))) ||
             db.WorkflowPlanAllocations.Any(allocation =>
                 allocation.Run.WorkItemId == item.Id &&
                 allocation.Unit.Roles.Any(role => role.Assignments.Any(assignment =>
                     assignment.PersonId == personId &&
                     assignment.IsActive &&
                     assignment.ValidFrom <= now &&
                     (assignment.ValidTo == null || assignment.ValidTo > now))))));

    private static HashSet<Guid> IncludeAncestors(
        IEnumerable<Guid> directlyAccessibleIds,
        IReadOnlyDictionary<Guid, WorkTreeNode> hierarchy)
    {
        var visibleIds = directlyAccessibleIds.ToHashSet();
        foreach (var accessibleId in visibleIds.ToArray())
        {
            var current = accessibleId;
            var visited = new HashSet<Guid>();
            while (visited.Add(current) &&
                   hierarchy.TryGetValue(current, out var node) &&
                   node.ParentWorkItemId is Guid parentId &&
                   hierarchy.ContainsKey(parentId))
            {
                visibleIds.Add(parentId);
                current = parentId;
            }
        }

        return visibleIds;
    }

    private static HashSet<Guid> IncludeDescendants(
        IEnumerable<Guid> rootIds,
        IReadOnlyCollection<WorkTreeNode> hierarchy)
    {
        var visibleIds = rootIds.ToHashSet();
        var children = hierarchy
            .Where(node => node.ParentWorkItemId is not null)
            .GroupBy(node => node.ParentWorkItemId!.Value)
            .ToDictionary(group => group.Key, group => group.Select(node => node.Id).ToList());
        var pending = new Stack<Guid>(visibleIds);
        while (pending.TryPop(out var parentId))
        {
            if (!children.TryGetValue(parentId, out var childIds)) continue;
            foreach (var childId in childIds)
                if (visibleIds.Add(childId)) pending.Push(childId);
        }

        return visibleIds;
    }
}
