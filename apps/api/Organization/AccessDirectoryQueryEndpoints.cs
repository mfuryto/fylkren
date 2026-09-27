using System.Security.Claims;
using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.Licensing;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class AccessDirectoryQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/directory-users", SearchUsers).RequireFeature(FeatureCatalog.ExternalIdentity);
        group.MapGet("/directory-providers", GetProviders);
    }

    private static async Task<IResult> SearchUsers(
        Guid siteId,
        string? provider,
        string? q,
        ClaimsPrincipal user,
        DirectoryAuthenticationService directory,
        FylkrenOptions options,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (await AccessAuthorization.Actor(siteId, user, database, cancellationToken) is null)
            return Results.Problem(statusCode: 403);
        provider = NormalizeProvider(provider);
        var query = q?.Trim() ?? "";
        if (provider is null || !Enabled(provider, options)) return Results.NotFound();
        if (query.Length < 2) return Results.Ok(Array.Empty<DirectoryCandidate>());
        if (query.Length > 100) return Results.BadRequest();
        IReadOnlyList<DirectoryUser> users;
        try
        {
            users = await directory.SearchUsersAsync(provider, query, 20, cancellationToken);
        }
        catch (InvalidOperationException)
        {
            return Results.NotFound();
        }
        var stableIds = users.Select(value => value.StableId).ToList();
        var existingInSite = await database.ExternalIdentityLinks.AsNoTracking()
            .Where(value => value.Provider == provider && stableIds.Contains(value.SubjectId) && value.IsActive &&
                value.Person.SiteMemberships.Any(membership => membership.SiteId == siteId && membership.IsActive))
            .Select(value => value.SubjectId)
            .ToListAsync(cancellationToken);
        return Results.Ok(users
            .Where(value => !existingInSite.Contains(value.StableId))
            .Select(value => new DirectoryCandidate(value.Provider, value.StableId, value.Username, value.DisplayName, value.Email)));
    }

    private static async Task<IResult> GetProviders(
        Guid siteId,
        ClaimsPrincipal user,
        FylkrenOptions options,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (await AccessAuthorization.Actor(siteId, user, database, cancellationToken) is null)
            return Results.Problem(statusCode: 403);
        return Results.Ok(new[]
        {
            new { key = "ad", name = "Active Directory", enabled = options.Authentication.ActiveDirectory.Enabled },
            new { key = "ldap", name = "LDAP", enabled = options.Authentication.Ldap.Enabled },
        }.Where(value => value.enabled));
    }

    private static string? NormalizeProvider(string? provider) =>
        provider?.Trim().ToLowerInvariant() is "ad" or "ldap"
            ? provider.Trim().ToLowerInvariant()
            : null;

    private static bool Enabled(string provider, FylkrenOptions options) =>
        provider == "ad"
            ? options.Authentication.ActiveDirectory.Enabled
            : provider == "ldap" && options.Authentication.Ldap.Enabled;

    private sealed record DirectoryCandidate(
        string Provider,
        string StableId,
        string Username,
        string? DisplayName,
        string? Email);
}
