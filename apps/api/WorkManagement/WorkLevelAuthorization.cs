using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkLevelAuthorization
{
    internal sealed record LevelAccess(Guid? LevelId, bool Belongs, bool Leads, bool CanPlan);

    internal static async Task<IReadOnlyList<LevelAccess>> AccessForLevels(
        Guid siteId,
        IEnumerable<Guid?> organizationUnitIds,
        Guid personId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var requestedLevels = organizationUnitIds.Distinct().ToArray();
        if (requestedLevels.Length == 0) return [];

        var leadershipId = await database.OrganizationUnits.AsNoTracking()
            .Where(value => value.SiteId == siteId && value.IsActive && value.IsSiteLeadership)
            .Select(value => (Guid?)value.Id)
            .SingleOrDefaultAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var assignments = await database.RoleAssignments.AsNoTracking()
            .Where(value => value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
                (value.ValidTo == null || value.ValidTo > now) && value.Role.IsActive &&
                value.Person.IsActive && value.Role.OrganizationUnit.SiteId == siteId &&
                value.Role.OrganizationUnit.Site.IsActive)
            .Select(value => new
            {
                UnitId = value.Role.OrganizationUnitId,
                value.Role.IsLeader,
                value.Role.HasLeaderAccess,
                value.Role.CanPlan,
                value.CanLeadParentLevel,
                UnitIsActive = value.Role.OrganizationUnit.IsActive,
                value.Role.OrganizationUnit.WorksAtParentLevel,
                value.Role.OrganizationUnit.ParentId,
                ParentIsLeadership = value.Role.OrganizationUnit.Parent != null && value.Role.OrganizationUnit.Parent.IsSiteLeadership,
                ParentIsRoot = value.Role.OrganizationUnit.Parent != null && value.Role.OrganizationUnit.Parent.IsSiteRoot
            })
            .ToListAsync(cancellationToken);
        var memberships = await database.OrganizationUnitMemberships.AsNoTracking()
            .Where(value => value.SiteId == siteId && value.PersonId == personId &&
                value.Person.IsActive && value.Site.IsActive && value.OrganizationUnit.IsActive)
            .Select(value => value.OrganizationUnitId)
            .ToListAsync(cancellationToken);
        var membershipIds = memberships.ToHashSet();
        var result = new List<LevelAccess>(requestedLevels.Length);

        foreach (var requestedLevel in requestedLevels)
        {
            var targetLevel = requestedLevel ?? leadershipId;
            if (targetLevel is null)
            {
                result.Add(new LevelAccess(requestedLevel, false, false, false));
                continue;
            }

            var belongs = membershipIds.Contains(targetLevel.Value) || assignments.Any(value =>
                value.UnitIsActive && value.UnitId == targetLevel ||
                value.UnitIsActive && value.WorksAtParentLevel && value.ParentId == targetLevel);
            var leads = requestedLevel is null
                ? assignments.Any(value =>
                    value.UnitIsActive && value.UnitId == targetLevel && (value.IsLeader || value.HasLeaderAccess) ||
                    value.IsLeader && value.CanLeadParentLevel && value.UnitIsActive && value.WorksAtParentLevel &&
                    (value.ParentIsLeadership || value.ParentIsRoot))
                : assignments.Any(value =>
                    value.UnitIsActive && value.UnitId == targetLevel && (value.IsLeader || value.HasLeaderAccess) ||
                    value.IsLeader && value.CanLeadParentLevel && value.UnitIsActive && value.WorksAtParentLevel &&
                    value.ParentId == targetLevel);
            var canPlan = assignments.Any(value =>
                value.UnitIsActive && value.UnitId == targetLevel && (value.CanPlan || value.IsLeader || value.HasLeaderAccess) ||
                value.UnitIsActive && value.WorksAtParentLevel &&
                (value.ParentId == targetLevel || value.ParentIsRoot) &&
                (value.CanPlan || value.IsLeader && value.CanLeadParentLevel));
            result.Add(new LevelAccess(requestedLevel, belongs, leads, canPlan));
        }

        return result;
    }

    public static Task<bool> IsSiteMember(
        Guid siteId,
        Guid personId,
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        database.SiteMemberships.AnyAsync(value =>
            value.SiteId == siteId && value.PersonId == personId && value.IsActive &&
            value.Site.IsActive && value.Person.IsActive,
            cancellationToken);

    public static async Task<bool> HasOperationalAccess(
        Guid siteId,
        Guid personId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        return await database.OrganizationUnitMemberships.AnyAsync(value =>
                value.SiteId == siteId && value.PersonId == personId &&
                value.Person.IsActive && value.Site.IsActive && value.OrganizationUnit.IsActive,
                cancellationToken) ||
            await database.RoleAssignments.AnyAsync(value =>
                value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
                (value.ValidTo == null || value.ValidTo > now) && value.Person.IsActive && value.Role.IsActive &&
                value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnit.SiteId == siteId &&
                value.Role.OrganizationUnit.Site.IsActive,
                cancellationToken);
    }

    public static async Task<Guid?> ResolveLevelId(
        Guid siteId,
        Guid? organizationUnitId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (organizationUnitId is Guid requestedUnitId)
            return await database.OrganizationUnits.AnyAsync(value =>
                value.Id == requestedUnitId && value.SiteId == siteId && value.IsActive && value.Site.IsActive,
                cancellationToken) ? requestedUnitId : null;

        return await database.OrganizationUnits
            .Where(value => value.SiteId == siteId && value.IsActive && value.IsSiteLeadership)
            .Select(value => (Guid?)value.Id)
            .SingleOrDefaultAsync(cancellationToken);
    }

    public static async Task<bool> BelongsToLevel(
        Guid siteId,
        Guid? organizationUnitId,
        Guid personId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var levelId = await ResolveLevelId(siteId, organizationUnitId, database, cancellationToken);
        if (levelId is null) return false;

        var now = DateTimeOffset.UtcNow;
        return await database.OrganizationUnitMemberships.AnyAsync(value =>
                value.SiteId == siteId && value.PersonId == personId &&
                value.Person.IsActive && value.Site.IsActive &&
                value.OrganizationUnitId == levelId && value.OrganizationUnit.IsActive,
                cancellationToken) ||
            await database.RoleAssignments.AnyAsync(value =>
                value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
                (value.ValidTo == null || value.ValidTo > now) && value.Person.IsActive && value.Role.IsActive &&
                value.Role.OrganizationUnit.SiteId == siteId &&
                value.Role.OrganizationUnit.Site.IsActive &&
                (value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnitId == levelId ||
                 value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnit.WorksAtParentLevel &&
                 value.Role.OrganizationUnit.ParentId == levelId),
                cancellationToken);
    }

    public static async Task<bool> LeadsLevel(
        Guid siteId,
        Guid? organizationUnitId,
        Guid personId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (organizationUnitId is null)
            return await OrganizationAuthorization.LeadsSiteTop(siteId, personId, database, cancellationToken);

        if (await ResolveLevelId(siteId, organizationUnitId, database, cancellationToken) is null)
            return false;

        var now = DateTimeOffset.UtcNow;
        return await database.RoleAssignments.AnyAsync(value =>
            value.PersonId == personId && value.IsActive && value.ValidFrom <= now &&
            (value.ValidTo == null || value.ValidTo > now) && value.Person.IsActive && value.Role.IsActive &&
            value.Role.OrganizationUnit.SiteId == siteId && value.Role.OrganizationUnit.Site.IsActive &&
            (value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnitId == organizationUnitId &&
                 (value.Role.IsLeader || value.Role.HasLeaderAccess) ||
             value.CanLeadParentLevel && value.Role.IsLeader &&
                 value.Role.OrganizationUnit.IsActive && value.Role.OrganizationUnit.WorksAtParentLevel &&
                 value.Role.OrganizationUnit.ParentId == organizationUnitId),
            cancellationToken);
    }

    public static async Task<HashSet<Guid>> ConfigurationLineage(
        Guid siteId,
        IEnumerable<Guid?> organizationUnitIds,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var units = await database.OrganizationUnits.AsNoTracking()
            .Where(value => value.SiteId == siteId && value.IsActive)
            .Select(value => new { value.Id, value.ParentId, value.IsSiteLeadership })
            .ToListAsync(cancellationToken);
        var parents = units.ToDictionary(value => value.Id, value => value.ParentId);
        var siteTop = units.Where(value => value.IsSiteLeadership).Select(value => (Guid?)value.Id).SingleOrDefault();
        var result = new HashSet<Guid>();

        foreach (var requestedUnitId in organizationUnitIds)
        {
            var current = requestedUnitId ?? siteTop;
            while (current is Guid id && result.Add(id))
                current = parents.GetValueOrDefault(id);
        }

        return result;
    }
}
