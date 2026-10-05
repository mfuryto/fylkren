using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static partial class IdentityEndpoints
{
    private static async Task<IResult> ListBrowserSessions(
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var identity = await CurrentIdentity(user, database, cancellationToken);
        if (identity is null || !Guid.TryParse(user.FindFirst("fylkren:session_id")?.Value, out var currentSessionId))
            return Results.Unauthorized();
        var now = DateTimeOffset.UtcNow;
        var sessions = await database.BrowserSessions.AsNoTracking()
            .Where(value => value.LoginIdentityId == identity.Id && value.SecurityVersion == identity.SecurityVersion &&
                value.RevokedAt == null && value.ExpiresAt > now)
            .OrderByDescending(value => value.LastSeenAt)
            .Select(value => new
            {
                value.Id,
                current = value.Id == currentSessionId,
                value.AuthenticationMethod,
                value.UserAgent,
                value.CreatedAt,
                value.LastSeenAt,
                value.ExpiresAt
            })
            .ToListAsync(cancellationToken);
        return Results.Ok(sessions);
    }

    private static async Task<IResult> RevokeBrowserSession(
        Guid id,
        [FromBody] ReauthenticationRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        IPasswordHasher<LoginIdentity> passwordHasher,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var identity = await CurrentIdentity(user, database, cancellationToken);
        if (identity is null || !Guid.TryParse(user.FindFirst("fylkren:session_id")?.Value, out var currentSessionId))
            return Results.Unauthorized();
        if (!SessionManagementReauthenticated(user, identity, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "Fresh authentication is required.");

        var now = DateTimeOffset.UtcNow;
        var session = await database.BrowserSessions.SingleOrDefaultAsync(value =>
            value.Id == id && value.LoginIdentityId == identity.Id && value.SecurityVersion == identity.SecurityVersion &&
            value.RevokedAt == null && value.ExpiresAt > now, cancellationToken);
        if (session is null) return Results.NotFound();
        session.Revoke(now);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId,
            "browser-session.revoked", "browser-session", session.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        if (session.Id == currentSessionId)
            await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static async Task<IResult> RevokeAllBrowserSessions(
        [FromBody] ReauthenticationRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        IPasswordHasher<LoginIdentity> passwordHasher,
        CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var identity = await CurrentIdentity(user, database, cancellationToken);
        if (identity is null) return Results.Unauthorized();
        if (!SessionManagementReauthenticated(user, identity, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "Fresh authentication is required.");

        var now = DateTimeOffset.UtcNow;
        await database.BrowserSessions
            .Where(value => value.LoginIdentityId == identity.Id && value.SecurityVersion == identity.SecurityVersion &&
                value.RevokedAt == null && value.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(value => value.RevokedAt, (DateTimeOffset?)now), cancellationToken);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId,
            "browser-sessions.revoked", "login-identity", identity.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        return Results.NoContent();
    }

    private static bool SessionManagementReauthenticated(
        ClaimsPrincipal user,
        LoginIdentity identity,
        string? currentPassword,
        IPasswordHasher<LoginIdentity> passwordHasher)
    {
        if (VerifyCurrentPassword(identity, currentPassword, passwordHasher)) return true;
        var startedAtValue = user.FindFirst("fylkren:session_started_at")?.Value;
        return long.TryParse(startedAtValue, out var startedAtSeconds) &&
            DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(startedAtSeconds) <= TimeSpan.FromMinutes(5);
    }
}
