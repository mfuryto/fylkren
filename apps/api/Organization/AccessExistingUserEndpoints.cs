using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class AccessExistingUserEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/existing-local-users", Search);
        group.MapPost("/existing-local-users", Add);
    }

    private static async Task<IResult> Search(
        Guid siteId,
        string? q,
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (await AccessAuthorization.Actor(siteId, user, database, cancellationToken) is null)
            return Results.Problem(statusCode: 403);
        var query = q?.Trim() ?? string.Empty;
        if (query.Length < 2) return Results.Ok(Array.Empty<UserCandidate>());
        if (query.Length > 100) return Results.BadRequest();
        var pattern = $"%{query.Replace("%", "\\%").Replace("_", "\\_")}%";
        return Results.Ok(await database.People.AsNoTracking()
            .Where(person => person.IsActive &&
                person.LoginIdentities.Any(identity => identity.IsActive) &&
                !person.ExternalIdentityLinks.Any(link => link.IsActive && (link.Provider == "ad" || link.Provider == "ldap")) &&
                person.SiteMemberships.Any(membership => membership.IsActive && membership.SiteId != siteId && membership.Site.IsActive) &&
                !person.SiteMemberships.Any(membership => membership.IsActive && membership.SiteId == siteId) &&
                (EF.Functions.ILike(person.DisplayName, pattern, "\\") ||
                 person.Email != null && EF.Functions.ILike(person.Email, pattern, "\\") ||
                 person.LoginIdentities.Any(identity => identity.IsActive && EF.Functions.ILike(identity.Username, pattern, "\\"))))
            .OrderBy(person => person.DisplayName)
            .Take(20)
            .Select(person => new UserCandidate(
                person.Id,
                person.DisplayName,
                person.Email,
                person.LoginIdentities.Where(identity => identity.IsActive).Select(identity => identity.Username).First(),
                person.SiteMemberships.Where(membership => membership.IsActive && membership.SiteId != siteId && membership.Site.IsActive)
                    .OrderBy(membership => membership.Site.Name).Select(membership => membership.Site.Name).ToArray()))
            .ToListAsync(cancellationToken));
    }

    private static async Task<IResult> Add(
        Guid siteId,
        AddRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context))
            return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var person = await database.People.Include(value => value.LoginIdentities)
            .Include(value => value.ExternalIdentityLinks)
            .SingleOrDefaultAsync(value => value.Id == request.PersonId && value.IsActive, cancellationToken);
        if (person is null ||
            !person.LoginIdentities.Any(identity => identity.IsActive) ||
            person.ExternalIdentityLinks.Any(link => link.IsActive && (link.Provider == "ad" || link.Provider == "ldap")))
            return Results.NotFound();
        if (!await database.SiteMemberships.AnyAsync(value => value.PersonId == person.Id && value.SiteId != siteId && value.IsActive && value.Site.IsActive, cancellationToken))
            return Results.Conflict(new { error = "The user no longer belongs to another active site." });
        if (await database.SiteMemberships.AnyAsync(value => value.SiteId == siteId && value.PersonId == person.Id && value.IsActive, cancellationToken))
            return Results.Conflict(new { error = "The user has already been added to this site." });
        var unit = await database.OrganizationUnits.SingleOrDefaultAsync(value => value.Id == request.OrganizationUnitId && value.SiteId == siteId && value.IsActive && !value.IsSiteRoot, cancellationToken);
        if (unit is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["organizationUnitId"] = ["Select an active subordinate unit in the receiving site."] });
        var now = DateTimeOffset.UtcNow;
        var previousMembership = await database.SiteMemberships.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == person.Id, cancellationToken);
        if (previousMembership is null) database.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), siteId, person.Id, now));
        else previousMembership.Activate();
        var previousUnitMembership = await database.OrganizationUnitMemberships.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == person.Id, cancellationToken);
        if (previousUnitMembership is not null) database.OrganizationUnitMemberships.Remove(previousUnitMembership);
        database.OrganizationUnitMemberships.Add(new OrganizationUnitMembership(Guid.NewGuid(), siteId, unit.Id, person.Id, now));
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "site-member.existing-local-user-added", "person", person.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created(
            $"/api/sites/{siteId}/access/members/{person.Id}",
            new MemberSummary(person.Id, person.DisplayName, person.Email, person.LoginIdentities.First(identity => identity.IsActive).Username, null, true, unit.Id, unit.Name));
    }

    private sealed record AddRequest(Guid PersonId, Guid OrganizationUnitId);
    private sealed record UserCandidate(Guid Id, string DisplayName, string? Email, string Username, IReadOnlyCollection<string> Sites);
    private sealed record MemberSummary(Guid Id, string DisplayName, string? Email, string? Username, string? DirectoryProvider, bool IsActive, Guid? OrganizationUnitId, string? OrganizationUnitName);
}
