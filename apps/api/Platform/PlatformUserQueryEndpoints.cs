using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static partial class PlatformUserEndpoints
{
    private static async Task<IResult> GetUsers(
        string? q,
        Guid? siteId,
        string? sort,
        int? page,
        int? pageSize,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (RequestQueryPolicy.Validate(page, q, pageSize) is { } queryError) return queryError;
        var currentPage = Math.Max(1, page ?? 1);
        var size = Math.Clamp(pageSize ?? 25, 1, 100);
        var query = database.People.AsNoTracking().Where(person => !person.IsDeleted);
        var search = q?.Trim();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var normalized = search.ToUpperInvariant();
            query = query.Where(person =>
                person.DisplayName.ToUpper().Contains(normalized) ||
                (person.NormalizedEmail != null && person.NormalizedEmail.Contains(normalized)) ||
                person.LoginIdentities.Any(identity => identity.NormalizedUsername.Contains(normalized)) ||
                person.ExternalIdentityLinks.Any(link =>
                    link.Provider.ToUpper().Contains(normalized) ||
                    link.SubjectId.ToUpper().Contains(normalized) ||
                    (link.Username != null && link.Username.ToUpper().Contains(normalized))) ||
                person.SiteMemberships.Any(membership => membership.Site.NormalizedName.Contains(normalized)));
        }

        if (siteId.HasValue)
        {
            query = query.Where(person => person.SiteMemberships.Any(membership =>
                membership.SiteId == siteId.Value && membership.IsActive && membership.Site.IsActive));
        }
        else if (string.IsNullOrWhiteSpace(search))
        {
            query = query.Where(person =>
                !person.LoginIdentities.Any(identity => identity.IsPlatformManager) &&
                !person.SiteMemberships.Any(membership => membership.IsActive && membership.Site.IsActive) &&
                !person.SiteManagerAssignments.Any(assignment => assignment.IsActive && assignment.Site.IsActive));
        }

        var total = await query.CountAsync(cancellationToken);
        var ordered = sort switch
        {
            "newest" => query.OrderByDescending(person => person.CreatedAt).ThenBy(person => person.Id),
            "oldest" => query.OrderBy(person => person.CreatedAt).ThenBy(person => person.Id),
            "name-desc" => query.OrderByDescending(person => person.DisplayName).ThenBy(person => person.Id),
            _ => query.OrderBy(person => person.DisplayName).ThenBy(person => person.Id),
        };
        var people = await ordered
            .Skip((currentPage - 1) * size)
            .Take(size)
            .Select(person => new { person.Id, person.DisplayName, person.Email, person.IsActive, person.CreatedAt })
            .ToListAsync(cancellationToken);
        var personIds = people.Select(person => person.Id).ToArray();
        _ = Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var currentPersonId);

        var logins = await database.LoginIdentities.AsNoTracking()
            .Where(identity => personIds.Contains(identity.PersonId))
            .Select(identity => new { identity.PersonId, identity.Username, identity.IsActive, identity.IsPlatformManager, identity.LastSignedInAt })
            .ToListAsync(cancellationToken);
        var externalIdentities = await database.ExternalIdentityLinks.AsNoTracking()
            .Where(link => personIds.Contains(link.PersonId))
            .Select(link => new { link.PersonId, link.Provider, link.Username, link.IsActive })
            .ToListAsync(cancellationToken);
        var memberships = await database.SiteMemberships.AsNoTracking()
            .Where(membership => personIds.Contains(membership.PersonId))
            .Select(membership => new { membership.PersonId, membership.SiteId, siteName = membership.Site.Name, membership.IsActive })
            .ToListAsync(cancellationToken);
        var managerSites = await database.SiteManagerAssignments.AsNoTracking()
            .Where(assignment => personIds.Contains(assignment.PersonId) && assignment.IsActive)
            .Select(assignment => new { assignment.PersonId, assignment.SiteId })
            .ToListAsync(cancellationToken);
        var sites = await database.Sites.AsNoTracking().Where(site => site.IsActive)
            .OrderBy(site => site.Name).Select(site => new { site.Id, site.Name }).ToListAsync(cancellationToken);

        var items = people.Select(person => new
        {
            person.Id,
            person.DisplayName,
            person.Email,
            person.IsActive,
            person.CreatedAt,
            isCurrentUser = person.Id == currentPersonId,
            loginIdentities = logins.Where(identity => identity.PersonId == person.Id).Select(identity => new
            {
                identity.Username,
                identity.IsActive,
                identity.IsPlatformManager,
                identity.LastSignedInAt
            }),
            externalIdentities = externalIdentities.Where(identity => identity.PersonId == person.Id).Select(identity => new
            {
                identity.Provider,
                identity.Username,
                identity.IsActive
            }),
            siteMemberships = memberships.Where(membership => membership.PersonId == person.Id).Select(membership => new
            {
                membership.SiteId,
                membership.siteName,
                membership.IsActive,
                isSiteManager = managerSites.Any(manager => manager.PersonId == person.Id && manager.SiteId == membership.SiteId)
            })
        });

        return Results.Ok(new { items, total, page = currentPage, pageSize = size, sites });
    }
}
