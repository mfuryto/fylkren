using System.Security.Claims;
using Fylkren.Api.Persistence;

namespace Fylkren.Api.Organization;

internal static class AccessAuthorization
{
    internal static async Task<Guid?> Actor(
        Guid siteId,
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId) &&
        await OrganizationAuthorization.CanAdministerSite(
            siteId,
            personId,
            database,
            cancellationToken)
            ? personId
            : null;
}
