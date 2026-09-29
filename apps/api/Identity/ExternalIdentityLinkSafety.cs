using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static class ExternalIdentityLinkSafety
{
    public static async Task<bool> CanDeactivateAsync(ExternalIdentityLink link, FylkrenDbContext database,
        FylkrenOptions options, CancellationToken cancellationToken)
    {
        var localEnabled = await database.IdentityProviderSettings.AsNoTracking()
            .Where(value => value.Provider == "local")
            .Select(value => value.Enabled)
            .SingleAsync(cancellationToken);
        if (localEnabled) return true;

        var protectsPlatformManager = await database.LoginIdentities.AsNoTracking().AnyAsync(value =>
            value.PersonId == link.PersonId && value.IsActive && value.IsPlatformManager && value.Person.IsActive,
            cancellationToken);
        if (!protectsPlatformManager) return true;

        var enabledProviders = await database.IdentityProviderSettings.AsNoTracking()
            .Where(value => value.Provider != "local" && value.Enabled && value.LastTestSucceeded == true)
            .Select(value => value.Provider)
            .ToArrayAsync(cancellationToken);
        var oidcInstanceId = options.Authentication.Oidc.Authority?.TrimEnd('/');
        var samlInstanceId = options.Authentication.Saml.IdentityProviderEntityId?.Trim();
        return await database.ExternalIdentityLinks.AsNoTracking().AnyAsync(value =>
            value.Id != link.Id && value.IsActive && enabledProviders.Contains(value.Provider) &&
            (value.Provider != "ad" && value.Provider != "ldap" || value.DirectoryAccessEnabled) &&
            (value.Provider != "oidc" || value.ProviderInstanceId == oidcInstanceId) &&
            (value.Provider != "saml" || value.ProviderInstanceId == samlInstanceId) &&
            value.Person.IsActive && value.Person.LoginIdentities.Any(identity => identity.IsActive && identity.IsPlatformManager),
            cancellationToken);
    }
}
