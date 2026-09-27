using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class IdentityProviderEndpoints
{
    public static IEndpointRouteBuilder MapIdentityProviderEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/identity").RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapPlatformUserEndpoints();
        group.MapGet("", GetConfiguration);
        group.MapGet("/oidc-links", (FylkrenDbContext database, CancellationToken cancellationToken) =>
            GetLinks("oidc", database, cancellationToken));
        group.MapPost("/oidc-links", (OidcLinkRequest request, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken) =>
            CreateLink("oidc", request.Username, request.SubjectId, antiforgery, context,
                database, cancellationToken)).RequireFeature(FeatureCatalog.ExternalIdentity);
        group.MapGet("/saml-links", (FylkrenDbContext database, CancellationToken cancellationToken) =>
            GetLinks("saml", database, cancellationToken));
        group.MapPost("/saml-links", (SamlLinkRequest request, IAntiforgery antiforgery,
            HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken) =>
            CreateLink("saml", request.Username, request.NameId, antiforgery, context,
                database, cancellationToken)).RequireFeature(FeatureCatalog.ExternalIdentity);
        return endpoints;
    }

    private static IResult GetConfiguration(FylkrenOptions options)
    {
        var authentication = options.Authentication;
        var externalEnabled = authentication.Oidc.Enabled || authentication.Saml.Enabled ||
            authentication.ActiveDirectory.Enabled || authentication.Ldap.Enabled;
        return Results.Ok(new
        {
            local = new { enabled = authentication.LocalEnabled, operational = true },
            providers = new object[]
            {
                Provider("Active Directory", "ad", authentication.ActiveDirectory.Enabled,
                    Present(authentication.ActiveDirectory.Server, authentication.ActiveDirectory.BaseDn,
                        authentication.ActiveDirectory.BindDn, authentication.ActiveDirectory.BindPassword),
                    "objectGUID"),
                Provider("LDAP", "ldap", authentication.Ldap.Enabled,
                    Present(authentication.Ldap.Server, authentication.Ldap.BaseDn,
                        authentication.Ldap.BindDn, authentication.Ldap.BindPassword),
                    "entryUUID"),
                Provider("OIDC", "oidc", authentication.Oidc.Enabled,
                    Present(authentication.Oidc.Authority, authentication.Oidc.ClientId,
                        authentication.Oidc.ClientSecret),
                    "sub"),
                Provider("SAML", "saml", authentication.Saml.Enabled,
                    Present(authentication.Saml.MetadataUrl, authentication.Saml.EntityId,
                        authentication.Saml.IdentityProviderEntityId),
                    "persistent NameID")
            },
            migration = new
            {
                status = externalEnabled ? "external-identity-operational" : "foundation",
                principle = "Behold intern person-ID og koble ekstern identitet med leverandørens stabile nøkkel.",
                usernameMatching = "Kun eksplisitt valg av eksisterende bruker; aldri varig koblingsnøkkel."
            }
        });
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
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var username = requestedUsername?.Trim() ?? string.Empty;
        var subject = requestedSubject?.Trim() ?? string.Empty;
        if (username.Length is < 1 or > 100 || subject.Length is < 1 or > 256)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["identity"] = ["Brukernavn og stabil identifikator må fylles ut med gyldig lengde."]
            });

        var normalizedUsername = username.ToUpperInvariant();
        var identity = await database.LoginIdentities.SingleOrDefaultAsync(value =>
            value.NormalizedUsername == normalizedUsername && value.IsActive, cancellationToken);
        if (identity is null)
            return Results.NotFound(new { error = "Den lokale brukeren finnes ikke eller er deaktivert." });
        if (await database.ExternalIdentityLinks.AnyAsync(link =>
                link.Provider == provider && link.SubjectId == subject && link.IsActive, cancellationToken))
            return Results.Conflict(new { error = $"{provider.ToUpperInvariant()}-identiteten er allerede koblet." });

        var link = new ExternalIdentityLink(Guid.NewGuid(), identity.PersonId, provider,
            subject, identity.Username, DateTimeOffset.UtcNow);
        database.Add(link);
        Record(database, context, $"identity.{provider}.linked", link.Id);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/platform/identity/{provider}-links/{link.Id}", new { link.Id });
    }

    private static object Provider(string name, string key, bool enabled, bool configurationPresent, string stableIdentifier) => new { name, key, enabledRequested = enabled, configurationPresent, operational = enabled && configurationPresent, stableIdentifier };
    private static bool Present(params string?[] values) => values.All(value => !string.IsNullOrWhiteSpace(value));
    private static void Record(FylkrenDbContext database, HttpContext context, string eventType, Guid entityId)
    {
        if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, eventType,
                "external-identity-link", entityId, DateTimeOffset.UtcNow));
    }
    private sealed record OidcLinkRequest(string? Username, string? SubjectId);
    private sealed record SamlLinkRequest(string? Username, string? NameId);
}
