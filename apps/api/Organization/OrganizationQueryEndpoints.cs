using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class OrganizationQueryEndpoints
{
    internal static RouteGroupBuilder MapOrganizationQueries(this RouteGroupBuilder group)
    {
        group.MapGet("/", GetSites);

        group.MapGet("/{siteId:guid}/organization-units", GetOrganizationUnits);
        return group;
    }

    private static async Task<IResult> GetSites(
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var query = database.Sites.AsNoTracking();
        if (!user.IsInRole("PlatformManager"))
        {
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId))
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
            var now = DateTimeOffset.UtcNow;
            query = query.Where(site => site.IsActive &&
                (site.Memberships.Any(membership =>
                     membership.PersonId == personId && membership.IsActive) ||
                 site.ManagerAssignments.Any(assignment =>
                     assignment.PersonId == personId && assignment.IsActive) ||
                 site.OrganizationUnits.Any(unit => unit.IsActive &&
                     unit.Roles.Any(role => role.IsActive &&
                         (role.IsLeader || role.HasLeaderAccess) &&
                         role.Assignments.Any(assignment =>
                             assignment.PersonId == personId &&
                             assignment.IsActive &&
                             assignment.ValidFrom <= now &&
                             (assignment.ValidTo == null || assignment.ValidTo > now))))));
        }

        var sites = await query
            .OrderBy(site => site.Name)
            .Select(site => new SiteSummary(
                site.Id,
                site.ParentOrganizationUnitId,
                site.Name,
                site.IsActive,
                site.OverviewDesign,
                site.ManagerAssignments
                    .Where(assignment => assignment.IsActive)
                    .OrderBy(assignment => assignment.Person.DisplayName)
                    .Select(assignment => new PersonSummary(
                        assignment.PersonId,
                        assignment.Person.DisplayName))
                    .ToList()))
            .ToListAsync(cancellationToken);
        return Results.Ok(sites);
    }

    internal static IEndpointRouteBuilder MapOrganizationPlatformQueries(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/people", SearchPeople)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        endpoints.MapGet("/api/site-placement-options", async (FylkrenDbContext database, CancellationToken cancellationToken) =>
            await database.OrganizationUnits.AsNoTracking()
                .Where(unit => unit.IsActive && unit.Site.IsActive)
                .OrderBy(unit => unit.Site.Name).ThenBy(unit => unit.IsSiteRoot ? 0 : 1).ThenBy(unit => unit.Name)
                .Select(unit => new PlacementOption(unit.Id, unit.SiteId, unit.Site.Name, unit.Name, unit.IsSiteRoot))
                .ToListAsync(cancellationToken))
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        return endpoints;
    }

    private static async Task<IResult> GetOrganizationUnits(Guid siteId, ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await database.Sites.AnyAsync(site => site.Id == siteId, cancellationToken))
            return Results.NotFound();

        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
        var canAdministerSite = await OrganizationAuthorization.CanAdministerSite(siteId, personId, database, cancellationToken);
        var visibleUnitIds = await OrganizationAuthorization.VisibleOrganizationUnitIds(siteId, personId, database, cancellationToken);
        if (visibleUnitIds.Count == 0 && !canAdministerSite)
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);

        var units = await database.OrganizationUnits
            .AsNoTracking()
            .Where(unit => unit.SiteId == siteId && !unit.IsSiteRoot && visibleUnitIds.Contains(unit.Id))
            .OrderBy(unit => unit.SortOrder).ThenBy(unit => unit.Name)
            .Select(unit => new OrganizationUnitSummary(
                unit.Id,
                unit.Parent == null || unit.Parent.IsSiteRoot || unit.ParentId == null || !visibleUnitIds.Contains(unit.ParentId.Value) ? null : unit.ParentId,
                unit.Name,
                unit.IsTemporary,
                unit.WorksAtParentLevel,
                unit.IsSiteLeadership,
                unit.IsActive,
                unit.SortOrder,
                false,
                null))
            .ToListAsync(cancellationToken);

        var attachedSites = await database.Sites.AsNoTracking()
            .Where(site => site.IsActive && site.ParentOrganizationUnit != null)
            .Select(site => new
            {
                site.Id,
                site.Name,
                ParentSiteId = site.ParentOrganizationUnit!.SiteId,
                ParentUnitId = site.ParentOrganizationUnitId!.Value,
                ParentIsRoot = site.ParentOrganizationUnit.IsSiteRoot,
                RootUnitId = site.OrganizationUnits.Where(unit => unit.IsSiteRoot).Select(unit => unit.Id).Single()
            }).ToListAsync(cancellationToken);
        var includedSiteNodes = new Dictionary<Guid, Guid> { [siteId] = Guid.Empty };
        var remainingSites = attachedSites.ToList();
        var addedSite = true;
        while (addedSite)
        {
            addedSite = false;
            foreach (var child in remainingSites.Where(value => includedSiteNodes.ContainsKey(value.ParentSiteId)).ToList())
            {
                if (child.ParentSiteId != siteId || child.ParentIsRoot || visibleUnitIds.Contains(child.ParentUnitId))
                {
                    var parentNodeId = child.ParentSiteId == siteId ? (Guid?)null : includedSiteNodes[child.ParentSiteId];
                    units.Add(new OrganizationUnitSummary(child.RootUnitId, parentNodeId, child.Name, false, false, false, true, int.MaxValue, true, child.Id));
                    includedSiteNodes[child.Id] = child.RootUnitId;
                    addedSite = true;
                }
                remainingSites.Remove(child);
            }
        }

        return Results.Ok(units);
    }

    private static async Task<IResult> SearchPeople(Guid? siteId, string? q, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var term = q?.Trim();
        if (siteId is null || string.IsNullOrWhiteSpace(term) || term.Length < 2)
            return Results.Ok(Array.Empty<PersonSearchResult>());
        var escapedTerm = term.Replace("\\", "\\\\", StringComparison.Ordinal)
            .Replace("%", "\\%", StringComparison.Ordinal)
            .Replace("_", "\\_", StringComparison.Ordinal);
        var pattern = $"%{escapedTerm}%";
        var people = await database.People
            .AsNoTracking()
            .Where(person => person.IsActive && person.LoginIdentities.Any(identity => identity.IsActive) && person.SiteMemberships.Any(membership => membership.SiteId == siteId && membership.IsActive && membership.Site.IsActive) &&
                (EF.Functions.ILike(person.DisplayName, pattern, "\\") || person.Email != null && EF.Functions.ILike(person.Email, pattern, "\\") || person.LoginIdentities.Any(identity => identity.IsActive && EF.Functions.ILike(identity.Username, pattern, "\\"))))
            .OrderBy(person => person.DisplayName)
            .Take(20)
            .Select(person => new PersonSearchResult(person.Id, person.DisplayName, person.Email))
            .ToListAsync(cancellationToken);
        return Results.Ok(people);
    }
}
