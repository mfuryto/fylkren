using System.Text.RegularExpressions;

namespace Fylkren.Api.Platform;

public sealed class FylkrenOptions
{
    public string PublicUrl { get; set; } = "http://localhost:8080";
    public LocalizationOptions Localization { get; set; } = new();
    public FeatureOptions Features { get; set; } = new();
    public AuthenticationOptions Authentication { get; set; } = new();
    public FederationOptions Federation { get; set; } = new();
    public OutboundOptions Outbound { get; set; } = new();
    public OperationsOptions Operations { get; set; } = new();

    public void Validate()
    {
        if (!Uri.TryCreate(PublicUrl, UriKind.Absolute, out var publicUri) ||
            publicUri.Scheme != Uri.UriSchemeHttp && publicUri.Scheme != Uri.UriSchemeHttps ||
            !string.IsNullOrEmpty(publicUri.UserInfo) ||
            publicUri.AbsolutePath != "/" ||
            !string.IsNullOrEmpty(publicUri.Query) ||
            !string.IsNullOrEmpty(publicUri.Fragment))
            throw new InvalidOperationException("Fylkren:PublicUrl must be an origin-only HTTP(S) URL without credentials, path, query or fragment.");
        PublicUrl = PublicUrl.TrimEnd('/');
        Fylkren.Api.Networking.OutboundHttpPolicy.ParseOrigins(Outbound.PrivateOrigins);
        Fylkren.Api.Networking.OutboundHttpPolicy.ParseOrigins(Outbound.AdditionalIdentityOrigins);
        Authentication.SsoAutoRedirectProvider = Authentication.SsoAutoRedirectProvider?.Trim().ToLowerInvariant();
        if (Authentication.SsoAutoRedirectProvider is not (null or "" or "oidc" or "saml"))
            throw new InvalidOperationException("The automatic SSO provider must be OIDC or SAML.");
        ValidateOidc();
        ValidateSaml();
        ValidateDirectory("Active Directory", Authentication.ActiveDirectory);
        ValidateDirectory("LDAP", Authentication.Ldap);
        if (Authentication.DirectoryLifecycle.IntervalMinutes is < 1 or > 1440)
            throw new InvalidOperationException("Directory lifecycle interval must be between 1 and 1440 minutes.");
        if (Authentication.DirectoryLifecycle.MissingConfirmationCount is < 1 or > 10)
            throw new InvalidOperationException("Directory lifecycle missing confirmation count must be between 1 and 10.");
        if (Authentication.MfaRequired && !Authentication.MfaEnabled)
            throw new InvalidOperationException("Mandatory MFA requires the MFA capability to be enabled.");
        if (!Authentication.LocalEnabled && !Authentication.Oidc.Enabled && !Authentication.Saml.Enabled && !Authentication.ActiveDirectory.Enabled && !Authentication.Ldap.Enabled)
            throw new InvalidOperationException("At least one operational authentication method must be enabled.");
        if (Federation.RetentionDays is < 365 or > 3650)
            throw new InvalidOperationException("Fylkren:Federation:RetentionDays must be between 365 and 3650 days.");
        if (!string.IsNullOrWhiteSpace(Operations.HostStatusPath) && !Path.IsPathFullyQualified(Operations.HostStatusPath))
            throw new InvalidOperationException("Fylkren:Operations:HostStatusPath must be an absolute path.");
        if (Operations.HostStatusMaximumAgeMinutes is < 1 or > 1440)
            throw new InvalidOperationException("Fylkren:Operations:HostStatusMaximumAgeMinutes must be between 1 and 1440.");
        if (Operations.BackupWarningHours is < 1 or > 720)
            throw new InvalidOperationException("Fylkren:Operations:BackupWarningHours must be between 1 and 720.");
        if (Authentication.MfaEnabled && Authentication.WebAuthn.Enabled)
        {
            if (string.IsNullOrWhiteSpace(Authentication.WebAuthn.RpId) || Authentication.WebAuthn.Origins.Count == 0)
                throw new InvalidOperationException("WebAuthn is enabled, but RP ID or origins are missing.");
            var relyingPartyId = Authentication.WebAuthn.RpId.Trim().ToLowerInvariant();
            if (Uri.CheckHostName(relyingPartyId) != UriHostNameType.Dns || relyingPartyId.Contains('/') || relyingPartyId.EndsWith('.'))
                throw new InvalidOperationException("WebAuthn RP ID must be a DNS host name without a scheme, port or path.");
            foreach (var value in Authentication.WebAuthn.Origins)
            {
                if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) ||
                    !string.IsNullOrEmpty(uri.UserInfo) || uri.AbsolutePath != "/" ||
                    !string.IsNullOrEmpty(uri.Query) || !string.IsNullOrEmpty(uri.Fragment) ||
                    uri.Scheme != Uri.UriSchemeHttps && !(uri.Scheme == Uri.UriSchemeHttp && uri.Host == "localhost") ||
                    !string.Equals(uri.Host, relyingPartyId, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Each WebAuthn origin must be an origin-only URL whose host exactly matches the RP ID; HTTPS is required except for localhost development.");
            }
            if (!Authentication.WebAuthn.Origins.Any(value =>
                    Uri.TryCreate(value, UriKind.Absolute, out var origin) &&
                    string.Equals(origin.Scheme, publicUri.Scheme, StringComparison.OrdinalIgnoreCase) &&
                    string.Equals(origin.Host, publicUri.Host, StringComparison.OrdinalIgnoreCase) &&
                    origin.Port == publicUri.Port))
                throw new InvalidOperationException("WebAuthn origins must include Fylkren:PublicUrl.");
        }
    }

    private static void ValidateDirectory(string name, DirectoryOptionsBase options)
    {
        if (!options.Enabled) return;
        if (new[] { options.Server, options.BaseDn, options.BindDn, options.BindPassword }.Any(string.IsNullOrWhiteSpace))
            throw new InvalidOperationException($"{name} is enabled, but required connection settings are missing.");
        if (!Fylkren.Api.Networking.ServiceDestinationPolicy.ValidServer(options.Server))
            throw new InvalidOperationException($"{name} server must be a single DNS name or allowed IP address, without a scheme, port, path or credentials.");
        if (options.Port is < 1 or > 65535)
            throw new InvalidOperationException($"{name} port must be between 1 and 65535.");
        if (options.UseSsl == options.UseStartTls)
            throw new InvalidOperationException($"{name} must enable exactly one of SSL or StartTLS.");
        foreach (var attribute in new[] { options.UsernameAttribute, options.DisplayNameAttribute, options.EmailAttribute, options.StableIdAttribute })
            if (string.IsNullOrWhiteSpace(attribute) || !Regex.IsMatch(attribute, "^[A-Za-z][A-Za-z0-9-]*$"))
                throw new InvalidOperationException($"{name} contains an invalid LDAP attribute name.");
        if (options.LifecycleActiveFilter.Length is < 3 or > 512 ||
            options.LifecycleActiveFilter.Any(char.IsControl) ||
            options.LifecycleActiveFilter[0] != '(' || options.LifecycleActiveFilter[^1] != ')' ||
            options.LifecycleActiveFilter.Count(character => character == '(') != options.LifecycleActiveFilter.Count(character => character == ')'))
            throw new InvalidOperationException($"{name} contains an invalid lifecycle active-account filter.");
    }
    private void ValidateOidc()
    {
        if (!Authentication.Oidc.Enabled) return;
        if (new[] { Authentication.Oidc.Authority, Authentication.Oidc.ClientId, Authentication.Oidc.ClientSecret }.Any(string.IsNullOrWhiteSpace)) throw new InvalidOperationException("OIDC is enabled, but authority, client ID or client secret is missing.");
        if (!Uri.TryCreate(Authentication.Oidc.Authority, UriKind.Absolute, out var authority) || !Fylkren.Api.Networking.OutboundHttpPolicy.ValidUri(authority)) throw new InvalidOperationException("OIDC authority must be an absolute HTTPS URL.");
        if (!ValidCallbackPath(Authentication.Oidc.CallbackPath))
            throw new InvalidOperationException("OIDC callback path must be a local absolute path without query or fragment.");
    }
    private void ValidateSaml()
    {
        if (!Authentication.Saml.Enabled) return;
        if (new[] { Authentication.Saml.MetadataUrl, Authentication.Saml.EntityId, Authentication.Saml.IdentityProviderEntityId }.Any(string.IsNullOrWhiteSpace))
            throw new InvalidOperationException("SAML is enabled, but metadata URL, SP entity ID or IdP entity ID is missing.");
        if (!Uri.TryCreate(Authentication.Saml.MetadataUrl, UriKind.Absolute, out var metadata) || !Fylkren.Api.Networking.OutboundHttpPolicy.ValidUri(metadata))
            throw new InvalidOperationException("SAML metadata URL must be an absolute HTTPS URL.");
        if (!Uri.TryCreate(Authentication.Saml.EntityId, UriKind.Absolute, out _))
            throw new InvalidOperationException("SAML SP entity ID must be an absolute URI.");
        if (!Uri.TryCreate(Authentication.Saml.IdentityProviderEntityId, UriKind.Absolute, out _))
            throw new InvalidOperationException("SAML IdP entity ID must be an absolute URI.");
        if (!ValidCallbackPath(Authentication.Saml.ModulePath) || Authentication.Saml.ModulePath.EndsWith('/'))
            throw new InvalidOperationException("SAML module path must be a local absolute path without query, fragment or trailing slash.");
    }

    private static bool ValidCallbackPath(string? value) =>
        !string.IsNullOrWhiteSpace(value) && value.StartsWith('/') && !value.StartsWith("//") &&
        !value.Contains('?') && !value.Contains('#') && !value.Contains('\\');
}

public sealed class LocalizationOptions
{
    public string DefaultLanguage { get; set; } = "en-US";
    public string TimeZone { get; set; } = "UTC";
}

public sealed class FeatureOptions { }

public sealed class FederationOptions
{
    public int RetentionDays { get; set; } = 2555;
}

public sealed class OperationsOptions
{
    public string? HostStatusPath { get; set; }
    public int HostStatusMaximumAgeMinutes { get; set; } = 15;
    public int BackupWarningHours { get; set; } = 36;
}

public sealed class AuthenticationOptions
{
    public bool LocalEnabled { get; set; } = true;
    public string? SsoAutoRedirectProvider { get; set; }
    public bool MfaEnabled { get; set; } = true;
    public bool MfaRequired { get; set; } = true;
    public OidcOptions Oidc { get; set; } = new();
    public SamlOptions Saml { get; set; } = new();
    public ActiveDirectoryOptions ActiveDirectory { get; set; } = new();
    public LdapOptions Ldap { get; set; } = new();
    public DirectoryLifecycleOptions DirectoryLifecycle { get; set; } = new();
    public WebAuthnOptions WebAuthn { get; set; } = new();
}

public sealed class OidcOptions { public bool Enabled { get; set; } public bool AutomaticProvisioning { get; set; } public string? Authority { get; set; } public string? ClientId { get; set; } public string? ClientSecret { get; set; } public string CallbackPath { get; set; } = "/signin-oidc"; }
public sealed class SamlOptions { public bool Enabled { get; set; } public bool AutomaticProvisioning { get; set; } public string? MetadataUrl { get; set; } public string? EntityId { get; set; } public string? IdentityProviderEntityId { get; set; } public string ModulePath { get; set; } = "/api/auth/saml2"; }
public abstract class DirectoryOptionsBase
{
    public bool Enabled { get; set; }
    public string? Server { get; set; }
    public int Port { get; set; } = 636;
    public bool UseSsl { get; set; } = true;
    public bool UseStartTls { get; set; }
    public string? BaseDn { get; set; }
    public string? UserSearchBase { get; set; }
    public string? BindDn { get; set; }
    public string? BindPassword { get; set; }
    public string UsernameAttribute { get; set; } = "uid";
    public string DisplayNameAttribute { get; set; } = "displayName";
    public string EmailAttribute { get; set; } = "mail";
    public string StableIdAttribute { get; set; } = "entryUUID";
    public string LifecycleActiveFilter { get; set; } = "(objectClass=*)";
}
public sealed class ActiveDirectoryOptions : DirectoryOptionsBase
{
    public string? Domain { get; set; }
    public ActiveDirectoryOptions()
    {
        UsernameAttribute = "sAMAccountName";
        StableIdAttribute = "objectGUID";
        LifecycleActiveFilter = "(!(userAccountControl:1.2.840.113556.1.4.803:=2))";
    }
}
public sealed class LdapOptions : DirectoryOptionsBase { }
public sealed class DirectoryLifecycleOptions
{
    public bool Enabled { get; set; } = true;
    public int IntervalMinutes { get; set; } = 15;
    public int MissingConfirmationCount { get; set; } = 3;
}
public sealed class WebAuthnOptions { public bool Enabled { get; set; } public string RpId { get; set; } = "localhost"; public string DisplayName { get; set; } = "Local installation"; public HashSet<string> Origins { get; set; } = ["http://localhost:8080"]; }

public sealed class OutboundOptions
{
    public string PrivateOrigins { get; set; } = "";
    public string AdditionalIdentityOrigins { get; set; } = "";
}
