using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemPolicy
{
    internal static Task<bool> IsOutgoingRequest(Guid itemId, Guid siteId, FylkrenDbContext db, CancellationToken ct) => db.WorkItems.AnyAsync(x => x.Id == itemId && x.SiteId == siteId && x.WorkItemType != null && x.WorkItemType.IsSystemManaged && (db.WorkItems.Any(child => child.ParentWorkItemId == x.Id && child.SenderSiteName != null && (child.SiteId != x.SiteId || child.AssignedUnitId != x.AssignedUnitId)) || db.FederationWorkLinks.Any(link => link.LocalWorkItemId == x.Id && link.Direction == "outgoing")), ct);
    internal static string? BuildInternalDelegationBasis(WorkItem parent, IEnumerable<(string UnitName, string FinalReport)> previousDeliveries)
    {
        var deliveries = previousDeliveries.ToList();
        if (deliveries.Count == 0) return parent.RequestBasisSnapshot;
        var sections = new List<string>();
        if (!string.IsNullOrWhiteSpace(parent.RequestBasisSnapshot)) sections.Add(parent.RequestBasisSnapshot);
        else if (!string.IsNullOrWhiteSpace(parent.Description)) sections.Add($"# Task basis\n\n## Primary task description\n{parent.Description}");
        foreach (var delivery in deliveries)
        {
            var section = $"## Previous final report from {delivery.UnitName}\n{delivery.FinalReport}";
            if (sections.Sum(value => value.Length) + section.Length > 95000) break;
            sections.Add(section);
        }
        return string.Join("\n\n", sections);
    }
    internal static bool PersonId(ClaimsPrincipal user, out Guid id) => Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);
    internal static Task<bool> IsMember(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) => WorkLevelAuthorization.IsSiteMember(site, person, db, ct);
    private static Task<bool> IsSiteManager(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) => db.SiteManagerAssignments.AnyAsync(x => x.SiteId == site && x.PersonId == person && x.IsActive, ct);
    internal static Task<bool> CanManageItem(WorkItem item, Guid person, FylkrenDbContext db, CancellationToken ct) => WorkLevelAuthorization.LeadsLevel(item.SiteId, item.AssignedUnitId, person, db, ct);
    internal static Task<bool> LeadsUnit(Guid site, Guid unit, Guid person, FylkrenDbContext db, CancellationToken ct) => WorkLevelAuthorization.LeadsLevel(site, unit, person, db, ct);
    internal static Task<bool> LeadsSiteRoot(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) => OrganizationAuthorization.LeadsSiteTop(site, person, db, ct);
    internal static Task<bool> CanLeadAnyLevel(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) { var now = DateTimeOffset.UtcNow; return db.RoleAssignments.AnyAsync(x => x.PersonId == person && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) && x.Role.IsActive && x.Role.OrganizationUnit.SiteId == site && x.Role.OrganizationUnit.IsActive && (x.Role.HasLeaderAccess || x.CanLeadParentLevel && x.Role.IsLeader), ct); }
    internal static Task<bool> HasTopLevelAccess(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) { var now = DateTimeOffset.UtcNow; return db.Sites.AnyAsync(x => x.Id == site && x.IsActive && (x.OrganizationUnits.Any(unit => unit.IsActive && unit.IsSiteLeadership && unit.Roles.Any(role => role.IsActive && role.Assignments.Any(a => a.PersonId == person && a.IsActive && a.ValidFrom <= now && (a.ValidTo == null || a.ValidTo > now)))) || x.OrganizationUnitMemberships.Any(membership => membership.PersonId == person && membership.OrganizationUnit.IsActive && membership.OrganizationUnit.WorksAtParentLevel && membership.OrganizationUnit.Parent != null && (membership.OrganizationUnit.Parent.IsSiteLeadership || membership.OrganizationUnit.Parent.IsSiteRoot))), ct); }
    internal static async Task<bool> CanReadReportsAtLevel(Guid site, Guid? unit, Guid person, FylkrenDbContext db, CancellationToken ct)
    {
        if (unit is null) return await HasTopLevelAccess(site, person, db, ct);
        var now = DateTimeOffset.UtcNow;
        return await db.OrganizationUnits.AnyAsync(x =>
            x.Id == unit && x.SiteId == site && x.IsActive &&
            (x.Memberships.Any(membership => membership.PersonId == person) ||
             x.Roles.Any(role => role.IsActive && role.Assignments.Any(assignment =>
                 assignment.PersonId == person && assignment.IsActive && assignment.ValidFrom <= now &&
                 (assignment.ValidTo == null || assignment.ValidTo > now))) ||
             x.Children.Any(child => child.IsActive && child.WorksAtParentLevel &&
                 child.Memberships.Any(membership => membership.PersonId == person))), ct);
    }
    internal static Task<bool> IsDedicatedTopLeader(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) { var now = DateTimeOffset.UtcNow; return db.RoleAssignments.AnyAsync(x => x.PersonId == person && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) && x.Role.IsActive && x.Role.IsLeader && x.Role.OrganizationUnit.SiteId == site && x.Role.OrganizationUnit.IsActive && x.Role.OrganizationUnit.IsSiteLeadership, ct); }
    internal static async Task<bool> CanCreateAtSiteRoot(Guid site, Guid person, FylkrenDbContext db, CancellationToken ct) { var now = DateTimeOffset.UtcNow; return await db.RoleAssignments.AnyAsync(x => x.PersonId == person && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) && x.Role.IsActive && x.Role.OrganizationUnit.SiteId == site && x.Role.OrganizationUnit.IsActive && x.Role.OrganizationUnit.IsSiteLeadership, ct) || await db.OrganizationUnitMemberships.AnyAsync(x => x.SiteId == site && x.PersonId == person && x.OrganizationUnit.IsActive && x.OrganizationUnit.WorksAtParentLevel && x.OrganizationUnit.Parent != null && (x.OrganizationUnit.Parent.IsSiteLeadership || x.OrganizationUnit.Parent.IsSiteRoot), ct); }
    internal static async Task<bool> IsDirectChild(Guid site, Guid? parentUnit, Guid requestedUnit, FylkrenDbContext db, CancellationToken ct)
    {
        if (parentUnit is Guid effectiveParent)
            return await db.OrganizationUnits.AnyAsync(x => x.Id == requestedUnit && x.IsActive && !x.IsSiteRoot && (x.SiteId == site && x.ParentId == effectiveParent || x.IsSiteLeadership && x.Site.ParentOrganizationUnitId == effectiveParent), ct);
        var topLevelIds = await db.OrganizationUnits.Where(x => x.SiteId == site && x.IsActive && (x.IsSiteRoot || x.IsSiteLeadership)).Select(x => x.Id).ToListAsync(ct);
        return await db.OrganizationUnits.AnyAsync(x => x.Id == requestedUnit && x.IsActive && !x.IsSiteRoot &&
            (x.SiteId == site && !x.IsSiteLeadership && x.ParentId != null && topLevelIds.Contains(x.ParentId.Value) ||
             x.SiteId != site && x.IsSiteLeadership && x.Site.ParentOrganizationUnitId != null && topLevelIds.Contains(x.Site.ParentOrganizationUnitId.Value)), ct);
    }
    internal static async Task<bool> CanReadWorkTree(Guid siteId, Guid itemId, Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var hierarchy = (await db.WorkItems.AsNoTracking()
            .Where(item => item.SiteId == siteId)
            .Select(item => new WorkTreeNode(item.Id, item.ParentWorkItemId))
            .ToListAsync(ct)).ToDictionary(item => item.Id);
        if (!hierarchy.ContainsKey(itemId)) return false;
        var treeIds = new HashSet<Guid> { itemId };
        var changed = true;
        while (changed)
        {
            changed = false;
            foreach (var node in hierarchy.Values.Where(node => node.ParentWorkItemId is Guid parentId && treeIds.Contains(parentId)))
                changed |= treeIds.Add(node.Id);
        }
        var now = DateTimeOffset.UtcNow;
        return await db.WorkItems.AnyAsync(item =>
            treeIds.Contains(item.Id) &&
            (item.CreatedByPersonId == personId ||
             item.AssignedUnitId != null && db.OrganizationUnitMemberships.Any(membership => membership.SiteId == siteId && membership.PersonId == personId && membership.OrganizationUnitId == item.AssignedUnitId && membership.OrganizationUnit.IsActive) ||
             item.AssignedUnit != null && item.AssignedUnit.Roles.Any(role => role.Assignments.Any(assignment =>
                 assignment.PersonId == personId && assignment.IsActive && assignment.ValidFrom <= now &&
                 (assignment.ValidTo == null || assignment.ValidTo > now))) ||
             db.WorkflowPlanAllocations.Any(allocation =>
                 allocation.Run.WorkItemId == item.Id &&
                 (db.OrganizationUnitMemberships.Any(membership =>
                      membership.SiteId == siteId && membership.PersonId == personId &&
                      membership.OrganizationUnitId == allocation.UnitId && membership.OrganizationUnit.IsActive) ||
                  allocation.Unit.Roles.Any(role => role.Assignments.Any(assignment =>
                      assignment.PersonId == personId && assignment.IsActive && assignment.ValidFrom <= now &&
                      (assignment.ValidTo == null || assignment.ValidTo > now)))))), ct);
    }

}
