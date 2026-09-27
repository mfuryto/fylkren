using System.Reflection;
using Fylkren.Api.Persistence;
using Fylkren.Api.Licensing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal static class PublicConfigurationEndpoints
{
    internal static void Map(WebApplication app)
    {
        app.MapGet("/api/configuration/public", async (FylkrenOptions options,
            FylkrenDbContext database, CancellationToken cancellationToken) =>
            Results.Ok(new
            {
                defaultLanguage = options.Localization.DefaultLanguage,
                timeZone = options.Localization.TimeZone,
                setupRequired = !await database.LoginIdentities.AnyAsync(
                    value => value.IsPlatformManager, cancellationToken),
                authentication = LoginMethods(options)
            })).AllowAnonymous();

        app.MapGet("/api/configuration", async (
            FylkrenOptions options,
            LicenseService license,
            FylkrenDbContext database,
            CancellationToken cancellationToken) =>
        {
            var classificationEnabled = await database.ClassificationSettings
                .AsNoTracking()
                .Where(value => value.Id == ClassificationEndpoints.SettingsId)
                .Select(value => value.IsEnabled)
                .SingleAsync(cancellationToken);
            var classificationMarkings = classificationEnabled
                ? await database.ClassificationDefinitions
                    .AsNoTracking()
                    .Where(value => value.IsActive)
                    .OrderBy(value => value.SortOrder)
                    .ThenBy(value => value.Name)
                    .Select(value => new { value.Name, value.Abbreviation })
                    .ToListAsync(cancellationToken)
                : [];
            var licenseStatus = await license.Current(database, cancellationToken);
            return Results.Ok(new
            {
                version = ProductVersion(),
                edition = licenseStatus.Edition,
                communitySiteLimit = SiteCapacityPolicy.CommunityActiveSiteLimit,
                entitlements = licenseStatus.Entitlements.Order(StringComparer.Ordinal).ToArray(),
                defaultLanguage = options.Localization.DefaultLanguage,
                timeZone = options.Localization.TimeZone,
                classificationEnabled,
                classificationMarkings,
                setupRequired = !await database.LoginIdentities.AnyAsync(
                    value => value.IsPlatformManager,
                    cancellationToken),
                authentication = LoginMethods(options)
            });
        }).RequireAuthorization();
    }

    private static object LoginMethods(FylkrenOptions options) => new
    {
        localEnabled = options.Authentication.LocalEnabled,
        mfaEnabled = options.Authentication.MfaEnabled,
        oidcConfigurationEnabled = options.Authentication.Oidc.Enabled,
        samlConfigurationEnabled = options.Authentication.Saml.Enabled,
        activeDirectoryConfigurationEnabled = options.Authentication.ActiveDirectory.Enabled,
        ldapConfigurationEnabled = options.Authentication.Ldap.Enabled,
        webAuthnEnabled = options.Authentication.MfaEnabled && options.Authentication.WebAuthn.Enabled
    };

    private static string ProductVersion()
    {
        var version = Assembly.GetExecutingAssembly().GetName().Version;
        return version is null
            ? "0.0.0"
            : $"{version.Major}.{version.Minor}.{version.Build}";
    }
}
