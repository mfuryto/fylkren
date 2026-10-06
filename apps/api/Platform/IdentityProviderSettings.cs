namespace Fylkren.Api.Platform;

public sealed class IdentityProviderSettings
{
    private IdentityProviderSettings() { }
    public IdentityProviderSettings(string provider, bool enabled, string protectedConfiguration, DateTimeOffset updatedAt)
    { Provider = provider; Enabled = enabled; ProtectedConfiguration = protectedConfiguration; UpdatedAt = updatedAt; }
    public string Provider { get; private set; } = "";
    public bool Enabled { get; private set; }
    public string ProtectedConfiguration { get; private set; } = "";
    public DateTimeOffset UpdatedAt { get; private set; }
    public DateTimeOffset? LastTestedAt { get; private set; }
    public bool? LastTestSucceeded { get; private set; }
    public string? LastTestError { get; private set; }
    public void Update(bool enabled, string protectedConfiguration, DateTimeOffset now)
    { Enabled = enabled; ProtectedConfiguration = protectedConfiguration; UpdatedAt = now; LastTestSucceeded = null; LastTestError = null; }
    public void SetEnabled(bool enabled, DateTimeOffset now)
    { Enabled = enabled; UpdatedAt = now; }
    internal void ReprotectConfiguration(string protectedConfiguration) => ProtectedConfiguration = protectedConfiguration;
    public void RecordTest(bool succeeded, string? error, DateTimeOffset now)
    { LastTestedAt = now; LastTestSucceeded = succeeded; LastTestError = error; }
}

public sealed record IdentityProviderConfiguration(
    string? Server = null, int Port = 636, string Security = "ldaps", string? BaseDn = null,
    string? UserSearchBase = null, string? BindDn = null, string? Secret = null,
    string? Domain = null, string UsernameAttribute = "uid", string DisplayNameAttribute = "displayName",
    string EmailAttribute = "mail", string StableIdAttribute = "entryUUID",
    string LifecycleActiveFilter = "(objectClass=*)", string? Authority = null,
    string? ClientId = null, string CallbackPath = "/signin-oidc", string? MetadataUrl = null,
    string? EntityId = null, string? IdentityProviderEntityId = null,
    string ModulePath = "/api/auth/saml2", string? SsoAutoRedirectProvider = null);
