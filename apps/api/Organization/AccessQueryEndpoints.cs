using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class AccessQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/", async (Guid siteId, ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId)) return Results.Problem(statusCode: 403);
            var canAdministerSite = await OrganizationAuthorization.CanAdministerSite(siteId, personId, database, cancellationToken);
            var visibleUnitIds = await OrganizationAuthorization.VisibleOrganizationUnitIds(siteId, personId, database, cancellationToken);
            if (visibleUnitIds.Count == 0 && !canAdministerSite) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var members = await database.SiteMemberships.AsNoTracking()
                .Where(value => value.SiteId == siteId && value.IsActive &&
                    (canAdministerSite && !value.Person.OrganizationUnitMemberships.Any(membership => membership.SiteId == siteId) ||
                     value.Person.OrganizationUnitMemberships.Any(membership => membership.SiteId == siteId && visibleUnitIds.Contains(membership.OrganizationUnitId)) ||
                     value.Person.RoleAssignments.Any(assignment => assignment.IsActive && assignment.ValidFrom <= now &&
                         (assignment.ValidTo == null || assignment.ValidTo > now) && assignment.Role.IsActive && visibleUnitIds.Contains(assignment.Role.OrganizationUnitId))))
                .OrderBy(value => value.Person.DisplayName)
                .Select(value => new MemberSummary(
                    value.PersonId,
                    value.Person.DisplayName,
                    value.Person.Email,
                    value.Person.ExternalIdentityLinks.Where(link => link.IsActive && (link.Provider == "ad" || link.Provider == "ldap")).Select(link => link.Username).FirstOrDefault() ?? value.Person.LoginIdentities.Select(identity => identity.Username).FirstOrDefault(),
                    value.Person.ExternalIdentityLinks.Where(link => link.IsActive && (link.Provider == "ad" || link.Provider == "ldap")).Select(link => link.Provider).FirstOrDefault(),
                    value.Person.IsActive,
                    value.Person.OrganizationUnitMemberships.Where(membership => membership.SiteId == siteId && visibleUnitIds.Contains(membership.OrganizationUnitId)).Select(membership => (Guid?)membership.OrganizationUnitId).FirstOrDefault(),
                    value.Person.OrganizationUnitMemberships.Where(membership => membership.SiteId == siteId && visibleUnitIds.Contains(membership.OrganizationUnitId)).Select(membership => membership.OrganizationUnit.Name).FirstOrDefault()))
                .ToListAsync(cancellationToken);
            var roles = await database.OrganizationRoles.AsNoTracking()
                .Where(value => value.OrganizationUnit.SiteId == siteId && visibleUnitIds.Contains(value.OrganizationUnitId) && value.OrganizationUnit.IsActive && !value.OrganizationUnit.IsSiteRoot && value.IsActive)
                .OrderBy(value => value.OrganizationUnit.Name)
                .ThenBy(value => value.Name)
                .Select(value => new RoleSummary(
                    value.Id,
                    value.OrganizationUnitId,
                    value.OrganizationUnit.Name,
                    value.Name,
                    value.IsLeader,
                    value.HasLeaderAccess,
                    value.CanPlan,
                    value.Assignments.Where(assignment => assignment.IsActive && (assignment.ValidTo == null || assignment.ValidTo > now))
                        .Select(assignment => new AssignmentSummary(assignment.Id, assignment.PersonId, assignment.Person.DisplayName, assignment.ValidFrom, assignment.ValidTo, assignment.CanLeadParentLevel)).ToList()))
                .ToListAsync(cancellationToken);
            return Results.Ok(new { members, roles });
        });
    }

    private sealed record MemberSummary(Guid Id, string DisplayName, string? Email, string? Username, string? DirectoryProvider, bool IsActive, Guid? OrganizationUnitId, string? OrganizationUnitName);
    private sealed record AssignmentSummary(Guid Id, Guid PersonId, string DisplayName, DateTimeOffset ValidFrom, DateTimeOffset? ValidTo, bool CanLeadParentLevel);
    private sealed record RoleSummary(Guid Id, Guid OrganizationUnitId, string OrganizationUnitName, string Name, bool IsLeader, bool HasLeaderAccess, bool CanPlan, IReadOnlyCollection<AssignmentSummary> Assignments);
}
