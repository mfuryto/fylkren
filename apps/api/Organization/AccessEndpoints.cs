using System.Security.Claims;
using Fylkren.Api.Persistence;

namespace Fylkren.Api.Organization;

public static class AccessEndpoints
{
    public static IEndpointRouteBuilder MapAccessEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sites/{siteId:guid}/access").RequireAuthorization();
        AccessQueryEndpoints.Map(group);
        AccessDirectoryQueryEndpoints.Map(group);
        AccessDirectoryCommandEndpoints.Map(group);
        AccessExistingUserEndpoints.Map(group);

        LocalUserEndpoints.Map(group);
        SiteMemberEndpoints.Map(group);

        AccessRoleEndpoints.Map(group);
        return endpoints;
    }

    internal static Task<Guid?> Actor(Guid siteId, ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken) =>
        AccessAuthorization.Actor(siteId, user, database, cancellationToken);
    internal static async Task<Guid?> LocalUserActor(Guid siteId, ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId)) return null;
        if (user.IsInRole("PlatformManager")) return personId;
        return await OrganizationAuthorization.CanAdministerSite(siteId, personId, database, cancellationToken) ? personId : null;
    }

    internal sealed record CreateLocalUserRequest(string DisplayName, string? Email, string Username, Guid? OrganizationUnitId);
    internal sealed record UpdateLocalUserRequest(string DisplayName, string? Email, string Username, bool IsActive, Guid? OrganizationUnitId);
    internal sealed record MemberSummary(Guid Id, string DisplayName, string? Email, string? Username, string? DirectoryProvider, bool IsActive, Guid? OrganizationUnitId, string? OrganizationUnitName);
}
