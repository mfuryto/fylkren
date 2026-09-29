using System.Security.Claims;
using System.Net.Mail;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.Licensing;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static class DirectoryEndpoints
{
    public static IEndpointRouteBuilder MapDirectoryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapPost("/api/session/directory", SignIn).AllowAnonymous().RequireRateLimiting("authentication");
        var platform = endpoints.MapGroup("/api/platform/identity").RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        platform.MapGet("/directory-links", ListLinks);
        platform.MapPost("/directory-links", LinkIdentity).RequireFeature(FeatureCatalog.ExternalIdentity);
        platform.MapDelete("/directory-links/{id:guid}", UnlinkIdentity);
        platform.MapPost("/directories/{provider}/test", TestConnection).RequireFeature(FeatureCatalog.ExternalIdentity);
        platform.MapPost("/directories/lifecycle/sync", SynchronizeLifecycle);
        return endpoints;
    }

    private static async Task<IResult> SignIn(DirectorySignInRequest request, DirectoryAuthenticationService directory,
        FylkrenOptions options, FylkrenDbContext database, HttpContext context, CancellationToken cancellationToken)
    {
        var provider = NormalizeProvider(request.Provider);
        if (provider is null || !IsEnabled(provider, options) || string.IsNullOrWhiteSpace(request.Username) ||
            request.Username.Length > 256 || string.IsNullOrWhiteSpace(request.Password) || request.Password.Length > 256)
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");

        DirectoryUser? directoryUser;
        try { directoryUser = await directory.AuthenticateAsync(provider, request.Username, request.Password, cancellationToken); }
        catch (InvalidOperationException) { return Results.NotFound(); }
        if (directoryUser is null)
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");

        var link = await database.ExternalIdentityLinks
            .SingleOrDefaultAsync(value => value.Provider == provider && value.SubjectId == directoryUser.StableId &&
                value.IsActive && value.DirectoryAccessEnabled, cancellationToken);
        if (link is null)
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Directory identity is not linked");

        var identity = await database.LoginIdentities.Include(value => value.Person)
            .SingleOrDefaultAsync(value => value.PersonId == link.PersonId && value.IsActive && value.Person.IsActive, cancellationToken);
        if (identity is null || !identity.IsPlatformManager &&
            !await IdentityEndpoints.HasActiveAccess(identity.PersonId, database, cancellationToken))
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");

        var displayName = string.IsNullOrWhiteSpace(directoryUser.DisplayName) ? identity.Person.DisplayName : directoryUser.DisplayName.Trim();
        var email = NormalizeEmail(directoryUser.Email);
        if (email is not null && await database.People.AnyAsync(value => value.Id != identity.PersonId && value.NormalizedEmail == email.ToUpperInvariant(), cancellationToken))
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");
        identity.Person.UpdateDirectoryProfile(displayName, email);
        link.UpdateUsername(directoryUser.Username);
        identity.RecordSignIn(DateTimeOffset.UtcNow);
        await database.SaveChangesAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            IdentityEndpoints.CreatePrincipal(identity, directoryManaged: true));
        return Results.NoContent();
    }

    private static async Task<IResult> ListLinks(FylkrenDbContext database, CancellationToken cancellationToken) =>
        Results.Ok(await database.ExternalIdentityLinks.AsNoTracking()
            .Where(value => (value.Provider == "ad" || value.Provider == "ldap") && value.IsActive)
            .OrderBy(value => value.Provider).ThenBy(value => value.Username)
            .Select(value => new
            {
                value.Id, value.Provider, value.SubjectId,
                directoryUsername = value.Username,
                displayName = value.Person.DisplayName,
                accessEnabled = value.DirectoryAccessEnabled,
                lifecycleStatus = value.DirectoryLifecycleStatus,
                missingCount = value.DirectoryMissingCount,
                lastCheckedAt = value.DirectoryLastCheckedAt,
                lastSuccessfulSyncAt = value.DirectoryLastSuccessfulSyncAt,
                suspendedAt = value.DirectorySuspendedAt
            })
            .ToListAsync(cancellationToken));

    private static async Task<IResult> LinkIdentity(DirectoryLinkRequest request, ClaimsPrincipal actor,
        IAntiforgery antiforgery, HttpContext context, DirectoryAuthenticationService directory,
        FylkrenOptions options, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var provider = NormalizeProvider(request.Provider);
        var localUsername = request.LocalUsername?.Trim() ?? "";
        var directoryUsername = request.DirectoryUsername?.Trim() ?? "";
        if (provider is null || !IsEnabled(provider, options) || localUsername.Length is < 1 or > 100 || directoryUsername.Length is < 1 or > 256)
            return Results.BadRequest();

        DirectoryUser? directoryUser;
        try { directoryUser = await directory.FindUserAsync(provider, directoryUsername, cancellationToken); }
        catch (InvalidOperationException) { return Results.BadRequest(); }
        if (directoryUser is null) return Results.NotFound(new { error = "Brukeren ble ikke funnet entydig i katalogen." });

        var identity = await database.LoginIdentities.Include(value => value.Person)
            .SingleOrDefaultAsync(value => value.NormalizedUsername == localUsername.ToUpperInvariant() && value.IsActive, cancellationToken);
        if (identity is null) return Results.NotFound(new { error = "Den lokale brukeren finnes ikke eller er deaktivert." });
        if (await database.ExternalIdentityLinks.AnyAsync(value => value.Provider == provider && value.PersonId == identity.PersonId && value.IsActive, cancellationToken))
            return Results.Conflict(new { error = "Den lokale brukeren har allerede en aktiv kobling til denne katalogtypen." });
        var existingLink = await database.ExternalIdentityLinks.SingleOrDefaultAsync(value => value.Provider == provider && value.SubjectId == directoryUser.StableId, cancellationToken);
        if (existingLink?.IsActive == true)
            return Results.Conflict(new { error = "Katalogidentiteten er allerede koblet." });

        var now = DateTimeOffset.UtcNow;
        var link = existingLink ?? new ExternalIdentityLink(Guid.NewGuid(), identity.PersonId, provider, directoryUser.StableId, directoryUser.Username, now);
        if (existingLink is null) database.ExternalIdentityLinks.Add(link);
        else link.Reactivate(identity.PersonId, directoryUser.Username, now);
        identity.DisableTotp();
        var credentials = await database.WebAuthnCredentials.Where(value => value.PersonId == identity.PersonId && value.IsActive).ToListAsync(cancellationToken);
        foreach (var credential in credentials) credential.Deactivate();
        if (Guid.TryParse(actor.FindFirstValue("fylkren:person_id"), out var actorPersonId))
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actorPersonId, $"identity.{provider}.linked", "external-identity-link", link.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/platform/identity/directory-links/{link.Id}", new
        {
            link.Id,
            link.Provider,
            link.SubjectId,
            directoryUsername = link.Username,
            directoryUser.DisplayName,
            directoryUser.Email
        });
    }

    private static async Task<IResult> UnlinkIdentity(Guid id, ClaimsPrincipal actor, IAntiforgery antiforgery,
        HttpContext context, FylkrenDbContext database, FylkrenOptions options, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var link = await database.ExternalIdentityLinks.SingleOrDefaultAsync(value => value.Id == id &&
            (value.Provider == "ad" || value.Provider == "ldap") && value.IsActive, cancellationToken);
        if (link is null) return Results.NotFound();
        if (!await ExternalIdentityLinkSafety.CanDeactivateAsync(link, database, options, cancellationToken))
            return Results.Conflict(new { error = "Koblingen kan ikke fjernes fordi den er siste aktive eksterne innlogging for en Platform Manager mens lokal innlogging er deaktivert." });
        link.Deactivate();
        if (Guid.TryParse(actor.FindFirstValue("fylkren:person_id"), out var actorPersonId))
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actorPersonId, $"identity.{link.Provider}.unlinked", "external-identity-link", link.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> TestConnection(string provider, IAntiforgery antiforgery, HttpContext context,
        DirectoryAuthenticationService directory, FylkrenOptions options, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        provider = NormalizeProvider(provider) ?? "";
        if (!IsEnabled(provider, options)) return Results.NotFound();
        try { return await directory.TestConnectionAsync(provider, cancellationToken) ? Results.NoContent() : Results.Problem(statusCode: 502, title: "Katalogforbindelsen mislyktes."); }
        catch (InvalidOperationException) { return Results.NotFound(); }
    }

    private static async Task<IResult> SynchronizeLifecycle(IAntiforgery antiforgery,
        HttpContext context, DirectoryLifecycleSynchronizer synchronizer, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        try
        {
            return Results.Ok(await synchronizer.RunOnceAsync(cancellationToken));
        }
        catch (InvalidOperationException)
        {
            return Results.Conflict(new { error = "En katalogsynkronisering kjører allerede." });
        }
    }

    private static string? NormalizeProvider(string? provider) => provider?.Trim().ToLowerInvariant() is "ad" or "ldap" ? provider.Trim().ToLowerInvariant() : null;
    private static string? NormalizeEmail(string? email)
    {
        if (string.IsNullOrWhiteSpace(email) || email.Length > 254) return null;
        try { var parsed = new MailAddress(email.Trim()); return string.Equals(parsed.Address, email.Trim(), StringComparison.OrdinalIgnoreCase) ? parsed.Address : null; }
        catch (FormatException) { return null; }
    }
    private static bool IsEnabled(string provider, FylkrenOptions options) => provider switch
    {
        "ad" => options.Authentication.ActiveDirectory.Enabled,
        "ldap" => options.Authentication.Ldap.Enabled,
        _ => false
    };

    private sealed record DirectorySignInRequest(string? Provider, string Username, string Password);
    private sealed record DirectoryLinkRequest(string? Provider, string? LocalUsername, string? DirectoryUsername);
}
