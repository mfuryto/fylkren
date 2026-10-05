using System.Data;
using System.Net.Mail;
using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static partial class IdentityEndpoints
{
    internal static bool MfaSatisfied(ClaimsPrincipal user) =>
        user.FindFirst("fylkren:mfa_satisfied")?.Value == "true";

    internal static BrowserSession StartBrowserSession(LoginIdentity identity, FylkrenDbContext database,
        HttpContext context, string authenticationMethod, DateTimeOffset? sessionStartedAt = null)
    {
        var startedAt = sessionStartedAt ?? DateTimeOffset.UtcNow;
        var session = new BrowserSession(Guid.NewGuid(), identity.Id, identity.SecurityVersion,
            authenticationMethod, context.Request.Headers.UserAgent.ToString(), startedAt, startedAt.AddHours(12));
        database.BrowserSessions.Add(session);
        return session;
    }

    internal static ClaimsPrincipal CreatePrincipal(LoginIdentity identity, Guid sessionId,
        DateTimeOffset? sessionStartedAt = null, bool directoryManaged = false, bool mfaSatisfied = false)
    {
        var now = DateTimeOffset.UtcNow;
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, identity.Id.ToString()),
            new(ClaimTypes.Name, identity.Username),
            new("fylkren:person_id", identity.PersonId.ToString()),
            new("fylkren:display_name", identity.Person.DisplayName),
            new("fylkren:must_change_password", identity.MustChangePassword ? "true" : "false"),
            new("fylkren:security_version", identity.SecurityVersion.ToString()),
            new("fylkren:session_id", sessionId.ToString()),
            new("fylkren:mfa_satisfied", mfaSatisfied ? "true" : "false"),
            new("fylkren:validated_at", now.ToUnixTimeSeconds().ToString()),
            new("fylkren:session_started_at", (sessionStartedAt ?? now).ToUnixTimeSeconds().ToString())
        };
        if (directoryManaged) claims.Add(new Claim("fylkren:directory_managed", "true"));
        if (identity.IsPlatformManager) claims.Add(new Claim(ClaimTypes.Role, "PlatformManager"));

        return new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme));
    }

    private static async Task<LoginIdentity?> CurrentIdentity(ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var identityId)) return null;
        var identity = await database.LoginIdentities.Include(value => value.Person).SingleOrDefaultAsync(value => value.Id == identityId && value.IsActive && value.Person.IsActive, cancellationToken);
        return identity is not null && (identity.IsPlatformManager || await HasActiveAccess(identity.PersonId, database, cancellationToken)) ? identity : null;
    }

    private static Task<bool> IsDirectoryManaged(Guid personId, FylkrenDbContext database, CancellationToken cancellationToken) =>
        database.ExternalIdentityLinks.AnyAsync(value => value.PersonId == personId && value.IsActive &&
            (value.Provider == "ad" || value.Provider == "ldap"), cancellationToken);

    internal static bool VerifyCurrentPassword(
        LoginIdentity identity,
        string? password,
        IPasswordHasher<LoginIdentity> passwordHasher) =>
        !string.IsNullOrEmpty(password) && password.Length <= 128 &&
        passwordHasher.VerifyHashedPassword(identity, identity.PasswordHash, password) != PasswordVerificationResult.Failed;

    private static async Task<IResult> SignOut(
        ClaimsPrincipal user,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var identityId))
        {
            var identity = await database.LoginIdentities.SingleOrDefaultAsync(
                value => value.Id == identityId,
                cancellationToken);
            if (identity is not null)
            {
                // ASP.NET authentication cookies are protected but self-contained. Advancing the
                // version ensures that a copied cookie cannot be replayed after explicit sign-out.
                identity.AdvanceSecurityVersion();
                var now = DateTimeOffset.UtcNow;
                await database.BrowserSessions
                    .Where(value => value.LoginIdentityId == identityId && value.RevokedAt == null)
                    .ExecuteUpdateAsync(update => update.SetProperty(value => value.RevokedAt, (DateTimeOffset?)now), cancellationToken);
                await database.SaveChangesAsync(cancellationToken);
            }
        }
        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }
}
