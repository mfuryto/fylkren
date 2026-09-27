using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkContextQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/context", async (ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId))
                return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var siteAccessRows = await db.Sites.AsNoTracking()
                .Where(site => site.IsActive &&
                    (site.Memberships.Any(membership => membership.PersonId == personId && membership.IsActive) ||
                     site.ManagerAssignments.Any(assignment => assignment.PersonId == personId && assignment.IsActive)))
                .OrderBy(site => site.Name)
                .Select(site => new
                {
                    SiteId = site.Id,
                    site.Name,
                    site.OverviewDesign,
                    IsSiteManager = site.ManagerAssignments.Any(assignment =>
                        assignment.PersonId == personId && assignment.IsActive),
                    HasWorkAccess = site.OrganizationUnitMemberships.Any(membership =>
                            membership.PersonId == personId && membership.OrganizationUnit.IsActive) ||
                        site.OrganizationUnits.Any(unit => unit.IsActive && unit.Roles.Any(role =>
                            role.IsActive && role.Assignments.Any(assignment =>
                                assignment.PersonId == personId && assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now)))),
                    IsTopLevelLeader = site.OrganizationUnits.Any(unit =>
                            unit.IsActive && unit.IsSiteLeadership && unit.Roles.Any(role =>
                                (role.IsLeader || role.HasLeaderAccess) && role.IsActive &&
                                role.Assignments.Any(assignment =>
                                    assignment.PersonId == personId && assignment.IsActive &&
                                    assignment.ValidFrom <= now &&
                                    (assignment.ValidTo == null || assignment.ValidTo > now)))) ||
                        site.OrganizationUnits.Any(unit =>
                            unit.IsActive && unit.WorksAtParentLevel && unit.Parent != null &&
                            (unit.Parent.IsSiteLeadership || unit.Parent.IsSiteRoot) &&
                            unit.Roles.Any(role => role.IsLeader && role.IsActive &&
                                role.Assignments.Any(assignment =>
                                    assignment.PersonId == personId && assignment.CanLeadParentLevel &&
                                    assignment.IsActive && assignment.ValidFrom <= now &&
                                    (assignment.ValidTo == null || assignment.ValidTo > now)))),
                    CanCancelWork = site.OrganizationUnits.Any(unit =>
                        unit.IsActive && unit.IsSiteLeadership && unit.Roles.Any(role =>
                            role.IsLeader && role.IsActive && role.Assignments.Any(assignment =>
                                assignment.PersonId == personId && assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now)))),
                    HasTopLevelAccess = site.OrganizationUnits.Any(unit =>
                            unit.IsActive && unit.IsSiteLeadership && unit.Roles.Any(role =>
                                role.IsActive && role.Assignments.Any(assignment =>
                                    assignment.PersonId == personId && assignment.IsActive &&
                                    assignment.ValidFrom <= now &&
                                    (assignment.ValidTo == null || assignment.ValidTo > now)))) ||
                        site.OrganizationUnitMemberships.Any(membership =>
                            membership.PersonId == personId && membership.OrganizationUnit.IsActive &&
                            membership.OrganizationUnit.WorksAtParentLevel &&
                            membership.OrganizationUnit.Parent != null &&
                            (membership.OrganizationUnit.Parent.IsSiteLeadership ||
                             membership.OrganizationUnit.Parent.IsSiteRoot)),
                    IsManager = site.OrganizationUnits.Any(unit =>
                        unit.IsActive && unit.Roles.Any(role =>
                            (role.IsLeader || role.HasLeaderAccess) && role.IsActive &&
                            role.Assignments.Any(assignment =>
                                assignment.PersonId == personId && assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now)))),
                    CanPlan = site.OrganizationUnits.Any(unit =>
                        unit.IsActive && unit.Roles.Any(role =>
                            (role.CanPlan || role.IsLeader || role.HasLeaderAccess) && role.IsActive &&
                            role.Assignments.Any(assignment =>
                                assignment.PersonId == personId && assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now))))
                })
                .ToListAsync(ct);
            var sites = siteAccessRows.Select(site => new
            {
                site.SiteId,
                site.Name,
                overviewDesign = site.OverviewDesign,
                isSiteManager = site.IsSiteManager,
                hasOperationalAccess = site.HasWorkAccess,
                hasExecutionAccess = site.HasWorkAccess,
                isTopLevelLeader = site.IsTopLevelLeader,
                canCancelWork = site.CanCancelWork,
                hasTopLevelAccess = site.HasTopLevelAccess,
                isManager = site.IsManager,
                canPlan = site.CanPlan
            }).ToList();
            var siteIds = sites.Select(site => site.SiteId).ToList();
            var units = await db.OrganizationUnits
                .AsNoTracking()
                .Where(unit => siteIds.Contains(unit.SiteId) && unit.IsActive && !unit.IsSiteRoot)
                .OrderBy(unit => unit.SortOrder)
                .ThenBy(unit => unit.Name)
                .Select(unit => new
                {
                    unit.Id,
                    unit.SiteId,
                    unit.Name,
                    parentId = unit.Parent != null && unit.Parent.IsSiteRoot ? null : unit.ParentId,
                    unit.IsSiteLeadership,
                    unit.SortOrder,
                    receivingSiteId = (Guid?)null,
                    assignedToMe = unit.Memberships.Any(membership => membership.PersonId == personId) ||
                        unit.Roles.Any(role => role.Assignments.Any(assignment =>
                            assignment.PersonId == personId &&
                            assignment.IsActive &&
                            assignment.ValidFrom <= now &&
                            (assignment.ValidTo == null || assignment.ValidTo > now))) ||
                        unit.Children.Any(child =>
                            child.IsActive &&
                            child.WorksAtParentLevel &&
                            child.Memberships.Any(membership => membership.PersonId == personId)),
                    isLeader = unit.Roles.Any(role =>
                            role.IsActive &&
                            (role.IsLeader || role.HasLeaderAccess) &&
                            role.Assignments.Any(assignment =>
                                assignment.PersonId == personId &&
                                assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now))) ||
                        unit.Children.Any(child =>
                            child.IsActive &&
                            child.WorksAtParentLevel &&
                            child.Roles.Any(role =>
                                role.IsLeader &&
                                role.IsActive &&
                                role.Assignments.Any(assignment =>
                                    assignment.PersonId == personId &&
                                    assignment.CanLeadParentLevel &&
                                    assignment.IsActive &&
                                    assignment.ValidFrom <= now &&
                                    (assignment.ValidTo == null || assignment.ValidTo > now))))
                })
                .ToListAsync(ct);
            var attachedSites = await db.Sites
                .AsNoTracking()
                .Where(site =>
                    site.IsActive &&
                    site.ParentOrganizationUnit != null &&
                    siteIds.Contains(site.ParentOrganizationUnit.SiteId))
                .OrderBy(site => site.Name)
                .Select(site => new
                {
                    Id = site.OrganizationUnits
                        .Where(unit => unit.IsActive && unit.IsSiteLeadership)
                        .Select(unit => unit.Id)
                        .Single(),
                    SiteId = site.ParentOrganizationUnit!.SiteId,
                    site.Name,
                    parentId = site.ParentOrganizationUnit.IsSiteRoot
                        ? (Guid?)null
                        : site.ParentOrganizationUnitId,
                    IsSiteLeadership = false,
                    SortOrder = int.MaxValue,
                    receivingSiteId = (Guid?)site.Id,
                    assignedToMe = false,
                    isLeader = false
                })
                .ToListAsync(ct);
            units.AddRange(attachedSites);
            return Results.Ok(new { sites, units });
        });
    }
}
