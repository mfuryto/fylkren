using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.Platform.AdministrationApiSupport;

namespace Fylkren.Api.Platform;

internal static class AdministrationUserQueryEndpoints
{
    internal static async Task<IResult> ListUsers(
        string? search,
        Guid? siteId,
        int? page,
        int? pageSize,
        FylkrenDbContext db,
        CancellationToken ct)
    {
        if (RequestQueryPolicy.Validate(page, search, pageSize) is { } queryError) return queryError;
        var pageNumber = Math.Max(page ?? 1, 1);
        var size = Math.Clamp(pageSize ?? 50, 1, 100);
        var query = db.People.AsNoTracking()
            .Where(person => !person.IsDeleted && !person.LoginIdentities.Any(identity => identity.IsPlatformManager));
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = RequestQueryPolicy.LikePattern(search);
            query = query.Where(person =>
                EF.Functions.ILike(person.DisplayName, pattern, "\\") ||
                person.Email != null && EF.Functions.ILike(person.Email, pattern, "\\") ||
                person.LoginIdentities.Any(identity => EF.Functions.ILike(identity.Username, pattern, "\\")) ||
                person.ExternalIdentityLinks.Any(identity =>
                    EF.Functions.ILike(identity.Provider, pattern, "\\") ||
                    identity.Username != null && EF.Functions.ILike(identity.Username, pattern, "\\")));
        }
        if (siteId is Guid selectedSiteId)
            query = query.Where(person => person.SiteMemberships.Any(membership => membership.SiteId == selectedSiteId && membership.IsActive && membership.Site.IsActive));
        var total = await query.CountAsync(ct);
        var ids = await query.OrderBy(person => person.DisplayName).ThenBy(person => person.Id)
            .Skip((pageNumber - 1) * size).Take(size).Select(person => person.Id).ToListAsync(ct);
        var users = await LoadUsers(db, ids, ct);
        return Results.Ok(new
        {
            items = ids.Select(id => users[id]),
            page = pageNumber,
            pageSize = size,
            total,
            totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)size)),
        });
    }

    internal static async Task<IResult> GetUser(Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var users = await LoadUsers(db, [personId], ct);
        return users.TryGetValue(personId, out var user) ? Results.Ok(user) : Results.NotFound();
    }

    private static async Task<Dictionary<Guid, UserResponse>> LoadUsers(
        FylkrenDbContext db,
        IReadOnlyCollection<Guid> ids,
        CancellationToken ct)
    {
        if (ids.Count == 0) return [];
        var people = await db.People.AsNoTracking()
            .Where(person => ids.Contains(person.Id) && !person.IsDeleted && !person.LoginIdentities.Any(identity => identity.IsPlatformManager))
            .Select(person => new { person.Id, person.DisplayName, person.Email, person.IsActive, person.CreatedAt })
            .ToListAsync(ct);
        var logins = await db.LoginIdentities.AsNoTracking().Where(identity => ids.Contains(identity.PersonId) && identity.IsActive)
            .Select(identity => new { identity.PersonId, identity.Username, identity.LastSignedInAt }).ToListAsync(ct);
        var external = await db.ExternalIdentityLinks.AsNoTracking().Where(identity => ids.Contains(identity.PersonId) && identity.IsActive)
            .Select(identity => new { identity.PersonId, identity.Provider, identity.Username }).ToListAsync(ct);
        var memberships = await db.SiteMemberships.AsNoTracking().Where(membership => ids.Contains(membership.PersonId) && membership.IsActive && membership.Site.IsActive)
            .Select(membership => new { membership.PersonId, membership.SiteId, SiteName = membership.Site.Name }).ToListAsync(ct);
        var managerKeys = (await db.SiteManagerAssignments.AsNoTracking()
            .Where(manager => ids.Contains(manager.PersonId) && manager.IsActive)
            .Select(manager => new { manager.PersonId, manager.SiteId }).ToListAsync(ct))
            .Select(manager => (manager.PersonId, manager.SiteId)).ToHashSet();
        return people.ToDictionary(
            person => person.Id,
            person => new UserResponse(
                person.Id,
                person.DisplayName,
                person.Email,
                person.IsActive,
                person.CreatedAt,
                logins.Where(identity => identity.PersonId == person.Id).Select(identity => new UserLoginResponse(identity.Username, identity.LastSignedInAt)).ToArray(),
                external.Where(identity => identity.PersonId == person.Id).Select(identity => new UserExternalIdentityResponse(identity.Provider, identity.Username)).ToArray(),
                memberships.Where(membership => membership.PersonId == person.Id).Select(membership => new UserSiteResponse(membership.SiteId, membership.SiteName, managerKeys.Contains((membership.PersonId, membership.SiteId)))).ToArray()));
    }


    private sealed record UserResponse(Guid Id, string DisplayName, string? Email, bool IsActive, DateTimeOffset CreatedAt, UserLoginResponse[] LoginIdentities, UserExternalIdentityResponse[] ExternalIdentities, UserSiteResponse[] SiteMemberships);
    private sealed record UserLoginResponse(string Username, DateTimeOffset? LastSignedInAt);
    private sealed record UserExternalIdentityResponse(string Provider, string? Username);
    private sealed record UserSiteResponse(Guid SiteId, string SiteName, bool IsSiteManager);
}
