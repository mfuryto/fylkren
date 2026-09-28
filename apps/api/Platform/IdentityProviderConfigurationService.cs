using System.Text.Json;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Sustainsys.Saml2.AspNetCore2;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public sealed class IdentityProviderConfigurationService(
    FylkrenOptions runtime,
    IDataProtectionProvider protection,
    IOptionsMonitorCache<OpenIdConnectOptions> oidcCache,
    IOptionsMonitorCache<Saml2Options> samlCache)
{
    public static readonly string[] ExternalProviders = ["ad", "ldap", "oidc", "saml"];
    public static readonly string[] Providers = ["local", .. ExternalProviders];
    private readonly IDataProtector protector = protection.CreateProtector("Fylkren.IdentityProviderConfiguration.v1");

    public async Task InitializeAsync(FylkrenDbContext database, CancellationToken cancellationToken = default)
    {
        foreach (var provider in Providers)
        {
            if (await database.IdentityProviderSettings.AnyAsync(value => value.Provider == provider, cancellationToken)) continue;
            var (enabled, configuration) = EnvironmentConfiguration(provider);
            database.IdentityProviderSettings.Add(new IdentityProviderSettings(provider, enabled, Protect(configuration), DateTimeOffset.UtcNow));
        }
        await database.SaveChangesAsync(cancellationToken);
        foreach (var value in await database.IdentityProviderSettings.AsNoTracking().ToListAsync(cancellationToken))
            Apply(value.Provider, value.Enabled, Unprotect(value.ProtectedConfiguration));
    }

    public IdentityProviderConfiguration Unprotect(string value) =>
        JsonSerializer.Deserialize<IdentityProviderConfiguration>(protector.Unprotect(value))
        ?? throw new InvalidOperationException("Identity provider configuration is invalid.");
    public string Protect(IdentityProviderConfiguration value) => protector.Protect(JsonSerializer.Serialize(value));

    public void Apply(string provider, bool enabled, IdentityProviderConfiguration value)
    {
        switch (provider)
        {
            case "local": runtime.Authentication.LocalEnabled = enabled; runtime.Authentication.SsoAutoRedirectProvider = Clean(value.SsoAutoRedirectProvider); break;
            case "ad": ApplyDirectory(runtime.Authentication.ActiveDirectory, enabled, value); runtime.Authentication.ActiveDirectory.Domain = Clean(value.Domain); break;
            case "ldap": ApplyDirectory(runtime.Authentication.Ldap, enabled, value); break;
            case "oidc":
                runtime.Authentication.Oidc.Enabled = enabled; runtime.Authentication.Oidc.Authority = Clean(value.Authority);
                runtime.Authentication.Oidc.ClientId = Clean(value.ClientId); runtime.Authentication.Oidc.ClientSecret = value.Secret;
                runtime.Authentication.Oidc.CallbackPath = value.CallbackPath; oidcCache.TryRemove(OpenIdConnectDefaults.AuthenticationScheme); break;
            case "saml":
                runtime.Authentication.Saml.Enabled = enabled; runtime.Authentication.Saml.MetadataUrl = Clean(value.MetadataUrl);
                runtime.Authentication.Saml.EntityId = Clean(value.EntityId); runtime.Authentication.Saml.IdentityProviderEntityId = Clean(value.IdentityProviderEntityId);
                runtime.Authentication.Saml.ModulePath = value.ModulePath; samlCache.TryRemove(Saml2Defaults.Scheme); break;
            default: throw new ArgumentOutOfRangeException(nameof(provider));
        }
    }

    public (bool Enabled, IdentityProviderConfiguration Configuration) EnvironmentConfiguration(string provider) => provider switch
    {
        "local" => (runtime.Authentication.LocalEnabled, new()),
        "ad" => (runtime.Authentication.ActiveDirectory.Enabled, FromDirectory(runtime.Authentication.ActiveDirectory, runtime.Authentication.ActiveDirectory.Domain)),
        "ldap" => (runtime.Authentication.Ldap.Enabled, FromDirectory(runtime.Authentication.Ldap, null)),
        "oidc" => (runtime.Authentication.Oidc.Enabled, new(Authority: runtime.Authentication.Oidc.Authority, ClientId: runtime.Authentication.Oidc.ClientId,
            Secret: runtime.Authentication.Oidc.ClientSecret, CallbackPath: runtime.Authentication.Oidc.CallbackPath)),
        "saml" => (runtime.Authentication.Saml.Enabled, new(MetadataUrl: runtime.Authentication.Saml.MetadataUrl, EntityId: runtime.Authentication.Saml.EntityId,
            IdentityProviderEntityId: runtime.Authentication.Saml.IdentityProviderEntityId, ModulePath: runtime.Authentication.Saml.ModulePath)),
        _ => throw new ArgumentOutOfRangeException(nameof(provider))
    };

    private static IdentityProviderConfiguration FromDirectory(DirectoryOptionsBase value, string? domain) => new(
        value.Server, value.Port, value.UseStartTls ? "starttls" : "ldaps", value.BaseDn, value.UserSearchBase,
        value.BindDn, value.BindPassword, domain, value.UsernameAttribute, value.DisplayNameAttribute,
        value.EmailAttribute, value.StableIdAttribute, value.LifecycleActiveFilter);
    private static void ApplyDirectory(DirectoryOptionsBase target, bool enabled, IdentityProviderConfiguration value)
    {
        target.Enabled = enabled; target.Server = Clean(value.Server); target.Port = value.Port;
        target.UseSsl = value.Security == "ldaps"; target.UseStartTls = value.Security == "starttls";
        target.BaseDn = Clean(value.BaseDn); target.UserSearchBase = Clean(value.UserSearchBase); target.BindDn = Clean(value.BindDn);
        target.BindPassword = value.Secret; target.UsernameAttribute = value.UsernameAttribute; target.DisplayNameAttribute = value.DisplayNameAttribute;
        target.EmailAttribute = value.EmailAttribute; target.StableIdAttribute = value.StableIdAttribute;
        target.LifecycleActiveFilter = value.LifecycleActiveFilter;
    }
    private static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
