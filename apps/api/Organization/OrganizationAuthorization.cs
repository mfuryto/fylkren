using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class OrganizationAuthorization
{
    public static Task<bool> LeadsSiteTop(Guid siteId, Guid personId, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return database.RoleAssignments.AnyAsync(value =>
            value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
            (value.ValidTo == null || value.ValidTo > now) && value.Role.IsActive &&
            value.Role.OrganizationUnit.Site.IsActive &&
            (value.Role.OrganizationUnit.SiteId == siteId && value.Role.OrganizationUnit.IsActive &&
             value.Role.OrganizationUnit.IsSiteLeadership && (value.Role.IsLeader || value.Role.HasLeaderAccess) ||
             value.CanLeadParentLevel && value.Role.IsLeader &&
             value.Role.OrganizationUnit.SiteId == siteId && value.Role.OrganizationUnit.IsActive &&
             value.Role.OrganizationUnit.WorksAtParentLevel && value.Role.OrganizationUnit.Parent != null &&
             (value.Role.OrganizationUnit.Parent.IsSiteLeadership || value.Role.OrganizationUnit.Parent.IsSiteRoot)), cancellationToken);
    }

    public static Task<bool> CanAdministerSite(Guid siteId, Guid personId, FylkrenDbContext database, CancellationToken cancellationToken) =>
        database.SiteManagerAssignments.AnyAsync(value =>
            value.SiteId == siteId && value.PersonId == personId && value.IsActive && value.Site.IsActive,
            cancellationToken);

    public static async Task<HashSet<Guid>> VisibleOrganizationUnitIds(Guid siteId, Guid personId, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var units = await database.OrganizationUnits.AsNoTracking()
            .Where(value => value.SiteId == siteId && value.IsActive && !value.IsSiteRoot)
            .Select(value => new { value.Id, value.ParentId })
            .ToListAsync(cancellationToken);

        if (await CanAdministerSite(siteId, personId, database, cancellationToken) ||
            await LeadsSiteTop(siteId, personId, database, cancellationToken))
            return units.Select(value => value.Id).ToHashSet();

        var visible = await LedOrganizationUnitIds(siteId, personId, database, cancellationToken);

        var added = true;
        while (added)
        {
            added = false;
            foreach (var unit in units.Where(value => value.ParentId is { } parentId && visible.Contains(parentId)))
                added |= visible.Add(unit.Id);
        }

        return visible;
    }

    public static async Task<HashSet<Guid>> LedOrganizationUnitIds(Guid siteId, Guid personId, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var assignments = await database.RoleAssignments.AsNoTracking()
            .Where(value => value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
                (value.ValidTo == null || value.ValidTo > now) && value.Role.IsActive &&
                value.Role.OrganizationUnit.SiteId == siteId && value.Role.OrganizationUnit.Site.IsActive &&
                value.Role.OrganizationUnit.IsActive)
            .Select(value => new
            {
                UnitId = value.Role.OrganizationUnitId,
                value.Role.IsLeader,
                value.Role.HasLeaderAccess,
                value.CanLeadParentLevel,
                value.Role.OrganizationUnit.WorksAtParentLevel,
                value.Role.OrganizationUnit.ParentId
            })
            .ToListAsync(cancellationToken);

        return assignments
            .Where(value => value.HasLeaderAccess)
            .Select(value => value.UnitId)
            .Concat(assignments
                .Where(value => value.IsLeader && value.CanLeadParentLevel && value.WorksAtParentLevel && value.ParentId != null)
                .Select(value => value.ParentId!.Value))
            .ToHashSet();
    }

    public static async Task<bool> CanPlanAtLevel(Guid siteId, Guid? organizationUnitId, Guid personId, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var targetUnitId = organizationUnitId ?? await database.OrganizationUnits
            .Where(value => value.SiteId == siteId && value.IsActive && value.IsSiteLeadership)
            .Select(value => (Guid?)value.Id)
            .SingleOrDefaultAsync(cancellationToken);
        if (targetUnitId is null) return false;
        var now = DateTimeOffset.UtcNow;
        return await database.RoleAssignments.AnyAsync(value =>
            value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
            (value.ValidTo == null || value.ValidTo > now) && value.Role.IsActive &&
            value.Role.OrganizationUnit.SiteId == siteId && value.Role.OrganizationUnit.Site.IsActive &&
            (value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnitId == targetUnitId &&
                 (value.Role.CanPlan || value.Role.IsLeader || value.Role.HasLeaderAccess) ||
             value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnit.WorksAtParentLevel &&
             (value.Role.OrganizationUnit.ParentId == targetUnitId ||
              value.Role.OrganizationUnit.Parent != null && value.Role.OrganizationUnit.Parent.IsSiteRoot) &&
             (value.Role.CanPlan || value.Role.IsLeader && value.CanLeadParentLevel)), cancellationToken);
    }

    public static Task<bool> CanPlanInSite(Guid siteId, Guid personId, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return database.RoleAssignments.AnyAsync(value => value.PersonId == personId && value.IsActive &&
            value.ValidFrom <= now && (value.ValidTo == null || value.ValidTo > now) && value.Role.IsActive &&
            value.Role.OrganizationUnit.SiteId == siteId && value.Role.OrganizationUnit.Site.IsActive &&
            value.Role.OrganizationUnit.IsActive &&
            (value.Role.CanPlan || value.Role.IsLeader || value.Role.HasLeaderAccess), cancellationToken);
    }
}
