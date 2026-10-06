using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using System.Text.RegularExpressions;
using System.Text.Json;
using System.Xml;
using Fylkren.Api.Networking;
using System.Xml.Linq;

namespace Fylkren.Api.Platform;

public static class IdentityProviderEndpoints
{
    public static IEndpointRouteBuilder MapIdentityProviderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/identity").RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapPlatformUserEndpoints();
        group.MapGet("", GetConfiguration);
        group.MapGet("/local", GetLocalProvider);
        group.MapPut("/local", UpdateLocalProvider);
        group.MapGet("/providers/{provider}", GetProvider);
        group.MapPut("/providers/{provider}", UpdateProvider).RequireFeature(FeatureCatalog.ExternalIdentity);
        group.MapPost("/providers/{provider}/test", TestProvider)
            .RequireFeature(FeatureCatalog.ExternalIdentity)
            .RequireRateLimiting("integration-test");
        group.MapGet("/oidc-links", (FylkrenDbContext database, CancellationToken cancellationToken) =>
            GetLinks("oidc", database, cancellationToken));
        group.MapPost("/oidc-links", (OidcLinkRequest request, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, IdentityProviderConfigurationService service, CancellationToken cancellationToken) =>
            CreateLink("oidc", request.Username, request.SubjectId, antiforgery, context,
                database, service, cancellationToken)).RequireFeature(FeatureCatalog.ExternalIdentity);
        group.MapDelete("/oidc-links/{id:guid}", (Guid id, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, FylkrenOptions options, CancellationToken cancellationToken) =>
            DeleteLink(id, "oidc", antiforgery, context, database, options, cancellationToken));
        group.MapGet("/saml-links", (FylkrenDbContext database, CancellationToken cancellationToken) =>
            GetLinks("saml", database, cancellationToken));
        group.MapPost("/saml-links", (SamlLinkRequest request, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, IdentityProviderConfigurationService service, CancellationToken cancellationToken) =>
            CreateLink("saml", request.Username, request.NameId, antiforgery, context,
                database, service, cancellationToken)).RequireFeature(FeatureCatalog.ExternalIdentity);
        group.MapDelete("/saml-links/{id:guid}", (Guid id, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, FylkrenOptions options, CancellationToken cancellationToken) =>
            DeleteLink(id, "saml", antiforgery, context, database, options, cancellationToken));
        group.MapGet("/provisioning-issues", GetProvisioningIssues);
        return endpoints;
    }

    private static async Task<IResult> GetConfiguration(FylkrenOptions options,
        FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var authentication = options.Authentication;
        var externalEnabled = authentication.Oidc.Enabled || authentication.Saml.Enabled ||
            authentication.ActiveDirectory.Enabled || authentication.Ldap.Enabled;
        var stored = await database.IdentityProviderSettings.AsNoTracking().ToDictionaryAsync(value => value.Provider, cancellationToken);
        return Results.Ok(new
        {
            local = new { enabled = authentication.LocalEnabled, operational = authentication.LocalEnabled },
            providers = new object[]
            {
                Provider("Active Directory", "ad", authentication.ActiveDirectory.Enabled, stored.GetValueOrDefault("ad"),
                    Present(authentication.ActiveDirectory.Server, authentication.ActiveDirectory.BaseDn,
                        authentication.ActiveDirectory.BindDn, authentication.ActiveDirectory.BindPassword),
                    "objectGUID"),
                Provider("LDAP", "ldap", authentication.Ldap.Enabled, stored.GetValueOrDefault("ldap"),
                    Present(authentication.Ldap.Server, authentication.Ldap.BaseDn,
                        authentication.Ldap.BindDn, authentication.Ldap.BindPassword),
                    "entryUUID"),
                Provider("OIDC", "oidc", authentication.Oidc.Enabled, stored.GetValueOrDefault("oidc"),
                    Present(authentication.Oidc.Authority, authentication.Oidc.ClientId,
                        authentication.Oidc.ClientSecret),
                    "sub"),
                Provider("SAML", "saml", authentication.Saml.Enabled, stored.GetValueOrDefault("saml"),
                    Present(authentication.Saml.MetadataUrl, authentication.Saml.EntityId,
                        authentication.Saml.IdentityProviderEntityId),
                    "persistent NameID")
            },
            migration = new
            {
                status = externalEnabled ? "external-identity-operational" : "foundation",
                principle = "Retain the internal person ID and link the external identity using the provider's stable key.",
                usernameMatching = "Explicit selection of an existing user only; never a persistent linking key."
            }
        });
    }

    private static async Task<IResult> GetProvider(string provider, FylkrenDbContext database,
        IdentityProviderConfigurationService service, CancellationToken cancellationToken)
    {
        provider = provider.Trim().ToLowerInvariant();
        if (!IdentityProviderConfigurationService.ExternalProviders.Contains(provider)) return Results.NotFound();
        var value = await database.IdentityProviderSettings.AsNoTracking().SingleAsync(item => item.Provider == provider, cancellationToken);
        var configuration = service.Unprotect(value.ProtectedConfiguration) with { Secret = null };
        return Results.Ok(new { value.Provider, value.Enabled, configuration, hasSecret = service.Unprotect(value.ProtectedConfiguration).Secret is not null,
            value.UpdatedAt, value.LastTestedAt, value.LastTestSucceeded, value.LastTestError });
    }

    private static async Task<IResult> UpdateProvider(string provider, ProviderUpdate request,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database,
        IdentityProviderConfigurationService service, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        provider = provider.Trim().ToLowerInvariant();
        if (!IdentityProviderConfigurationService.ExternalProviders.Contains(provider)) return Results.NotFound();
        var value = await database.IdentityProviderSettings.SingleAsync(item => item.Provider == provider, cancellationToken);
        var previous = service.Unprotect(value.ProtectedConfiguration);
        var configuration = request.Configuration with
        {
            Secret = request.ClearSecret ? null : string.IsNullOrEmpty(request.Configuration.Secret) ? previous.Secret : request.Configuration.Secret
        };
        if (ValidateProvider(provider, request.Enabled, configuration) is { } validation) return validation;
        var configurationChanged = configuration != previous;
        if (request.Enabled && (configurationChanged || value.LastTestSucceeded != true))
            return Results.Conflict(new { error = "Save the configuration as disabled, run a successful connection test, and then activate the service." });
        var now = DateTimeOffset.UtcNow;
        if (configurationChanged) value.Update(request.Enabled, service.Protect(configuration), now);
        else value.SetEnabled(request.Enabled, now);
        var local = await database.IdentityProviderSettings.SingleAsync(item => item.Provider == "local", cancellationToken);
        var localConfiguration = service.Unprotect(local.ProtectedConfiguration);
        if ((configurationChanged || !request.Enabled) &&
            string.Equals(localConfiguration.SsoAutoRedirectProvider, provider, StringComparison.Ordinal))
        {
            localConfiguration = localConfiguration with { SsoAutoRedirectProvider = null };
            local.Update(local.Enabled, service.Protect(localConfiguration), DateTimeOffset.UtcNow);
            service.Apply("local", local.Enabled, localConfiguration);
        }
        RecordProvider(database, context, $"identity.{provider}.configuration-updated", provider);
        await database.SaveChangesAsync(cancellationToken);
        service.Apply(provider, request.Enabled, configuration);
        return Results.NoContent();
    }

    private static async Task<IResult> TestProvider(string provider, IAntiforgery antiforgery,
        HttpContext context, FylkrenDbContext database, DirectoryAuthenticationService directory,
        IHttpClientFactory httpClients, IdentityProviderConfigurationService service,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        provider = provider.Trim().ToLowerInvariant();
        if (!IdentityProviderConfigurationService.ExternalProviders.Contains(provider)) return Results.NotFound();
        var value = await database.IdentityProviderSettings.SingleAsync(item => item.Provider == provider, cancellationToken);
        var configuration = service.Unprotect(value.ProtectedConfiguration);
        if (ValidateProvider(provider, enabled: true, configuration) is { } validation) return validation;
        var succeeded = false;
        try
        {
            succeeded = provider switch
            {
                "ad" or "ldap" => await directory.TestConfiguredConnectionAsync(provider, cancellationToken),
                "oidc" => await TestOidc(httpClients, configuration, cancellationToken),
                "saml" => await TestSaml(httpClients, configuration, cancellationToken),
                _ => false
            };
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException or UriFormatException or JsonException or XmlException)
        { succeeded = false; }
        value.RecordTest(succeeded, succeeded ? null : "Connection or validation failed. See the technical logs.", DateTimeOffset.UtcNow);
        RecordProvider(database, context, $"identity.{provider}.connection-tested", provider);
        await database.SaveChangesAsync(cancellationToken);
        return succeeded ? Results.NoContent() : Results.Problem(statusCode: 502, title: "Tilkoblingstesten mislyktes.");
    }

    private static async Task<byte[]?> DownloadMetadata(IHttpClientFactory clients, Uri address, CancellationToken cancellationToken)
    {
        using var response = await clients.CreateClient("identity-provider-test").GetAsync(address,
            HttpCompletionOption.ResponseHeadersRead, cancellationToken);
        if (!response.IsSuccessStatusCode || response.Content.Headers.ContentLength is > 2_000_000) return null;
        await using var source = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var target = new MemoryStream();
        var buffer = new byte[16_384];
        while (true)
        {
            var read = await source.ReadAsync(buffer, cancellationToken);
            if (read == 0) break;
            if (target.Length + read > 2_000_000) return null;
            target.Write(buffer, 0, read);
        }
        return target.ToArray();
    }

    private static async Task<bool> TestOidc(IHttpClientFactory clients, IdentityProviderConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var address = new Uri(new Uri(configuration.Authority!.TrimEnd('/') + "/"), ".well-known/openid-configuration");
        var body = await DownloadMetadata(clients, address, cancellationToken);
        if (body is null) return false;
        using var document = JsonDocument.Parse(body);
        var root = document.RootElement;
        static bool HttpsUri(JsonElement element, out Uri? uri)
        {
            uri = null;
            return element.ValueKind == JsonValueKind.String &&
                Uri.TryCreate(element.GetString(), UriKind.Absolute, out uri) && OutboundHttpPolicy.ValidUri(uri);
        }
        static string CanonicalIssuer(Uri uri) => uri.AbsoluteUri.TrimEnd('/');

        return root.ValueKind == JsonValueKind.Object && root.TryGetProperty("issuer", out var issuer) && HttpsUri(issuer, out var issuerUri) &&
            CanonicalIssuer(issuerUri!) == CanonicalIssuer(new Uri(configuration.Authority)) &&
            root.TryGetProperty("authorization_endpoint", out var authorization) && HttpsUri(authorization, out _) &&
            root.TryGetProperty("token_endpoint", out var token) && HttpsUri(token, out _) &&
            root.TryGetProperty("jwks_uri", out var keys) && HttpsUri(keys, out _);
    }

    private static async Task<bool> TestSaml(IHttpClientFactory clients, IdentityProviderConfiguration configuration,
        CancellationToken cancellationToken)
    {
        var body = await DownloadMetadata(clients, new Uri(configuration.MetadataUrl!), cancellationToken);
        if (body is null) return false;
        using var stream = new MemoryStream(body);
        using var reader = XmlReader.Create(stream, new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null, MaxCharactersInDocument = 2_000_000 });
        var document = XDocument.Load(reader, LoadOptions.None);
        return document.Descendants().Where(value => value.Name.LocalName == "EntityDescriptor")
            .Any(value => string.Equals((string?)value.Attribute("entityID"), configuration.IdentityProviderEntityId, StringComparison.Ordinal));
    }

    private static async Task<IResult> GetLocalProvider(FylkrenDbContext database,
        IdentityProviderConfigurationService service, CancellationToken cancellationToken)
    {
        var value = await database.IdentityProviderSettings.AsNoTracking().SingleAsync(item => item.Provider == "local", cancellationToken);
        return Results.Ok(new { value.Provider, value.Enabled, configuration = service.Unprotect(value.ProtectedConfiguration), hasSecret = false,
            value.UpdatedAt, value.LastTestedAt, value.LastTestSucceeded, value.LastTestError });
    }

    private static async Task<IResult> UpdateLocalProvider(ProviderUpdate request, IAntiforgery antiforgery,
        HttpContext context, FylkrenDbContext database, IdentityProviderConfigurationService service,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var requestedSso = request.Configuration.SsoAutoRedirectProvider?.Trim().ToLowerInvariant();
        if (requestedSso is not (null or "" or "oidc" or "saml")) return Results.BadRequest();
        if (!string.IsNullOrEmpty(requestedSso))
        {
            var ready = await database.IdentityProviderSettings.AsNoTracking().AnyAsync(value =>
                value.Provider == requestedSso && value.Enabled && value.LastTestSucceeded == true, cancellationToken);
            if (!ready) return Results.Conflict(new { error = "Direct SSO requires the selected OIDC or SAML service to be active and to have passed its connection test." });
        }
        if (!request.Enabled)
        {
            var enabledProviders = await database.IdentityProviderSettings.AsNoTracking()
                .Where(value => value.Provider != "local" && value.Enabled && value.LastTestSucceeded == true &&
                    (string.IsNullOrEmpty(requestedSso) || value.Provider == requestedSso))
                .Select(value => value.Provider).ToArrayAsync(cancellationToken);
            var hasExternalManager = await database.ExternalIdentityLinks.AsNoTracking().AnyAsync(link =>
                link.IsActive && enabledProviders.Contains(link.Provider) &&
                (link.Provider != "ad" && link.Provider != "ldap" || link.DirectoryAccessEnabled) &&
                link.Person.IsActive && link.Person.LoginIdentities.Any(identity => identity.IsActive && identity.IsPlatformManager), cancellationToken);
            if (!hasExternalManager)
                return Results.Conflict(new { error = "Local sign-in can only be disabled after an active Platform Manager is linked to an active external sign-in service." });
        }
        var value = await database.IdentityProviderSettings.SingleAsync(item => item.Provider == "local", cancellationToken);
        var configuration = service.Unprotect(value.ProtectedConfiguration) with { SsoAutoRedirectProvider = string.IsNullOrEmpty(requestedSso) ? null : requestedSso };
        value.Update(request.Enabled, service.Protect(configuration), DateTimeOffset.UtcNow);
        RecordProvider(database, context, "identity.local.configuration-updated", "local");
        await database.SaveChangesAsync(cancellationToken);
        service.Apply("local", request.Enabled, configuration);
        return Results.NoContent();
    }

    private static IResult? ValidateProvider(string provider, bool enabled, IdentityProviderConfiguration value)
    {
        static bool Attribute(string? text) => !string.IsNullOrWhiteSpace(text) && Regex.IsMatch(text, "^[A-Za-z][A-Za-z0-9-]*$");
        static bool Length(string? text, int maximum) => text is null || text.Length <= maximum && !text.Any(char.IsControl);
        static bool LocalPath(string? text) => !string.IsNullOrWhiteSpace(text) && text.StartsWith('/') && !text.StartsWith("//") &&
            !text.Contains('?') && !text.Contains('#') && !text.Contains('\\');
        var valid = provider switch
        {
            "ad" or "ldap" => value.Port is >= 1 and <= 65535 && value.Security is "ldaps" or "starttls" &&
                (string.IsNullOrWhiteSpace(value.Server) || ServiceDestinationPolicy.ValidServer(value.Server)) && Length(value.Server, 255) && Length(value.BaseDn, 1000) && Length(value.UserSearchBase, 1000) && Length(value.BindDn, 1000) && Length(value.Secret, 2000) && Length(value.Domain, 255) &&
                (!enabled || new[] { value.Server, value.BaseDn, value.BindDn, value.Secret }.All(item => !string.IsNullOrWhiteSpace(item))) &&
                Attribute(value.UsernameAttribute) && Attribute(value.DisplayNameAttribute) && Attribute(value.EmailAttribute) && Attribute(value.StableIdAttribute) &&
                value.LifecycleActiveFilter is { Length: >= 3 and <= 512 } lifecycleActiveFilter &&
                !lifecycleActiveFilter.Any(char.IsControl) &&
                lifecycleActiveFilter.StartsWith('(') && lifecycleActiveFilter.EndsWith(')') &&
                lifecycleActiveFilter.Count(character => character == '(') == lifecycleActiveFilter.Count(character => character == ')'),
            "oidc" => LocalPath(value.CallbackPath) && (!enabled || Uri.TryCreate(value.Authority, UriKind.Absolute, out var uri) && OutboundHttpPolicy.ValidUri(uri) &&
                !string.IsNullOrWhiteSpace(value.ClientId) && !string.IsNullOrWhiteSpace(value.Secret)) && Length(value.Authority, 1000) && Length(value.ClientId, 500) && Length(value.Secret, 2000),
            "saml" => LocalPath(value.ModulePath) && !value.ModulePath.EndsWith('/') && (!enabled ||
                Uri.TryCreate(value.MetadataUrl, UriKind.Absolute, out var metadata) && OutboundHttpPolicy.ValidUri(metadata) &&
                Uri.TryCreate(value.EntityId, UriKind.Absolute, out _) && Uri.TryCreate(value.IdentityProviderEntityId, UriKind.Absolute, out _)),
            _ => false
        };
        return valid ? null : Results.ValidationProblem(new Dictionary<string, string[]> { ["provider"] = ["Check all required fields, addresses, attributes, and connection options."] });
    }

    private static async Task<IResult> GetLinks(
        string provider,
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        Results.Ok(await database.ExternalIdentityLinks.AsNoTracking()
            .Where(link => link.Provider == provider && link.IsActive)
            .OrderBy(link => link.Username)
            .Select(link => new
            {
                link.Id,
                link.SubjectId,
                providerInstanceId = link.ProviderInstanceId,
                link.Username,
                displayName = link.Person.DisplayName
            })
            .ToListAsync(cancellationToken));

    private static async Task<IResult> CreateLink(
        string provider,
        string? requestedUsername,
        string? requestedSubject,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        IdentityProviderConfigurationService service,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var username = requestedUsername?.Trim() ?? string.Empty;
        var subject = requestedSubject?.Trim() ?? string.Empty;
        if (username.Length is < 1 or > 100 || subject.Length is < 1 or > 256)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["identity"] = ["The username and stable identifier must be provided with valid lengths."]
            });

        var normalizedUsername = username.ToUpperInvariant();
        var identity = await database.LoginIdentities.SingleOrDefaultAsync(value =>
            value.NormalizedUsername == normalizedUsername && value.IsActive, cancellationToken);
        if (identity is null)
            return Results.NotFound(new { error = "The local user does not exist or is disabled." });
        var setting = await database.IdentityProviderSettings.AsNoTracking()
            .SingleAsync(value => value.Provider == provider, cancellationToken);
        var providerInstanceId = IdentityProviderConfigurationService.ProviderInstanceId(
            provider, service.Unprotect(setting.ProtectedConfiguration));
        if (providerInstanceId is null)
            return Results.Conflict(new { error = $"{provider.ToUpperInvariant()} must be configured before the identity can be linked." });
        var existingLink = await database.ExternalIdentityLinks.SingleOrDefaultAsync(link =>
            link.Provider == provider && link.ProviderInstanceId == providerInstanceId && link.SubjectId == subject,
            cancellationToken);
        if (existingLink?.IsActive == true)
            return Results.Conflict(new { error = $"The {provider.ToUpperInvariant()} identity is already linked." });

        var now = DateTimeOffset.UtcNow;
        var link = existingLink ?? new ExternalIdentityLink(Guid.NewGuid(), identity.PersonId, provider,
            providerInstanceId, subject, identity.Username, now);
        if (existingLink is null) database.Add(link);
        else link.Reactivate(identity.PersonId, identity.Username, now);
        var issue = await database.ExternalIdentityProvisioningIssues.SingleOrDefaultAsync(value =>
            value.Provider == provider && value.ProviderInstanceId == providerInstanceId &&
            value.SubjectId == subject && value.ResolvedAt == null, cancellationToken);
        issue?.Resolve(now);
        Record(database, context, $"identity.{provider}.linked", link.Id);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/platform/identity/{provider}-links/{link.Id}", new { link.Id });
    }

    private static async Task<IResult> GetProvisioningIssues(FylkrenDbContext database,
        CancellationToken cancellationToken) => Results.Ok(await database.ExternalIdentityProvisioningIssues
        .AsNoTracking().Where(value => value.ResolvedAt == null)
        .OrderByDescending(value => value.LastSeenAt)
        .Select(value => new { value.Id, value.Provider, value.ProviderInstanceId, value.SubjectId,
            value.Username, value.DisplayName, value.Email, value.Reason, value.FirstSeenAt, value.LastSeenAt })
        .ToListAsync(cancellationToken));

    private static async Task<IResult> DeleteLink(Guid id, string provider, IAntiforgery antiforgery,
        HttpContext context, FylkrenDbContext database, FylkrenOptions options, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var link = await database.ExternalIdentityLinks.SingleOrDefaultAsync(value =>
            value.Id == id && value.Provider == provider && value.IsActive, cancellationToken);
        if (link is null) return Results.NotFound();
        if (!await ExternalIdentityLinkSafety.CanDeactivateAsync(link, database, options, cancellationToken))
            return Results.Conflict(new { error = "The link cannot be removed because it is the last active external sign-in for a Platform Manager while local sign-in is disabled." });
        link.Deactivate();
        Record(database, context, $"identity.{provider}.unlinked", link.Id);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static object Provider(string name, string key, bool enabled, IdentityProviderSettings? stored, bool configurationPresent, string stableIdentifier) => new { name, key, enabledRequested = enabled, configurationPresent, operational = enabled && configurationPresent, stableIdentifier, stored?.LastTestedAt, stored?.LastTestSucceeded };
    private static bool Present(params string?[] values) => values.All(value => !string.IsNullOrWhiteSpace(value));
    private static void Record(FylkrenDbContext database, HttpContext context, string eventType, Guid entityId)
    {
        if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, eventType,
                "external-identity-link", entityId, DateTimeOffset.UtcNow));
    }
    private static void RecordProvider(FylkrenDbContext database, HttpContext context, string eventType, string provider)
    {
        if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, eventType,
                "identity-provider-settings", ProviderEntityId(provider), DateTimeOffset.UtcNow));
    }
    private static Guid ProviderEntityId(string provider) => provider switch
    { "local" => Guid.Parse("00000000-0000-0000-0000-000000000010"), "ad" => Guid.Parse("00000000-0000-0000-0000-000000000011"), "ldap" => Guid.Parse("00000000-0000-0000-0000-000000000012"), "oidc" => Guid.Parse("00000000-0000-0000-0000-000000000013"), _ => Guid.Parse("00000000-0000-0000-0000-000000000014") };
    private sealed record ProviderUpdate(bool Enabled, bool ClearSecret, IdentityProviderConfiguration Configuration);
    private sealed record OidcLinkRequest(string? Username, string? SubjectId);
    private sealed record SamlLinkRequest(string? Username, string? NameId);
}
