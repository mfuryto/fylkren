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
        {
            var regional = await database.RegionalSettings.AsNoTracking()
                .SingleAsync(value => value.Id == DatabaseDefaults.RegionalSettingsId, cancellationToken);
            return Results.Ok(new
            {
                regional.DefaultLanguage,
                regional.TimeZone,
                regional.ClockFormat,
                regional.MeasurementSystem,
                setupRequired = !await database.LoginIdentities.AnyAsync(
                    value => value.IsPlatformManager, cancellationToken),
                authentication = LoginMethods(options)
            });
        }).AllowAnonymous();

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
            var aiEnabled = await database.AiSettings.AsNoTracking().Where(value => value.Id == DatabaseDefaults.AiSettingsId).Select(value => value.Enabled).SingleAsync(cancellationToken);
            var regional = await database.RegionalSettings.AsNoTracking()
                .SingleAsync(value => value.Id == DatabaseDefaults.RegionalSettingsId, cancellationToken);
            return Results.Ok(new
            {
                version = ProductVersion(),
                edition = licenseStatus.Edition,
                communitySiteLimit = SiteCapacityPolicy.CommunityActiveSiteLimit,
                entitlements = licenseStatus.Entitlements.Order(StringComparer.Ordinal).ToArray(),
                regional.DefaultLanguage,
                regional.TimeZone,
                regional.ClockFormat,
                regional.MeasurementSystem,
                classificationEnabled,
                classificationMarkings,
                aiEnabled,
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
        mfaRequired = options.Authentication.MfaRequired,
        oidcConfigurationEnabled = options.Authentication.Oidc.Enabled,
        samlConfigurationEnabled = options.Authentication.Saml.Enabled,
        activeDirectoryConfigurationEnabled = options.Authentication.ActiveDirectory.Enabled,
        ldapConfigurationEnabled = options.Authentication.Ldap.Enabled,
        ssoAutoRedirectProvider = options.Authentication.SsoAutoRedirectProvider,
        webAuthnEnabled = options.Authentication.MfaEnabled && options.Authentication.WebAuthn.Enabled
    };

    internal static string ProductVersion()
    {
        var informational = Assembly.GetExecutingAssembly()
            .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion;
        if (!string.IsNullOrWhiteSpace(informational)) return informational.Split('+', 2)[0];
        return Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.0.0";
    }
}
