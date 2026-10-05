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
    private static async Task<IResult> BeginTotpSetup(ReauthenticationRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, TotpService totp, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (identity.TotpEnabled) return Results.Conflict(new { error = "Two-factor authentication is already active." });
        if (!MfaSatisfied(user) && await database.WebAuthnCredentials.AnyAsync(
                value => value.PersonId == identity.PersonId && value.IsActive, cancellationToken))
            return Results.Conflict(new { error = "Use the registered passkey before adding another factor." });
        if (!VerifyCurrentPassword(identity, request.CurrentPassword, passwordHasher) &&
            !(options.Authentication.MfaRequired && FreshPendingMfaSession(user)))
            return Results.Problem(statusCode: 400, title: "The current password is incorrect.");
        var secret = totp.CreateSecret();
        var branding = await database.BrandingSettings.AsNoTracking().Select(value => new { value.ProductName, value.InstanceName }).SingleAsync(cancellationToken);
        return Results.Ok(new { secret, setupToken = totp.CreateSetupToken(identity.Id, identity.SecurityVersion, secret), provisioningUri = totp.ProvisioningUri(branding.ProductName, branding.InstanceName, identity.Username, secret) });
    }

    private static async Task<IResult> ConfirmTotpSetup(TotpSetupRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, TotpService totp, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.SetupToken) || request.SetupToken.Length > 4096 ||
            string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 128)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["The setup or code is invalid. Start again."] });
        (Guid IdentityId, long SecurityVersion, string Secret) setup;
        try { setup = totp.ReadSetupToken(request.SetupToken); }
        catch { return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["The setup is invalid or expired. Start again."] }); }
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var identityLockKey = BitConverter.ToInt64(identity.Id.ToByteArray(), 0);
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({identityLockKey})", cancellationToken);
        await database.Entry(identity).ReloadAsync(cancellationToken);
        if (setup.IdentityId != identity.Id || setup.SecurityVersion != identity.SecurityVersion)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["The setup is no longer valid. Start again."] });
        var secret = setup.Secret;
        if (!totp.Verify(secret, request.Code)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["The code could not be verified."] });
        var recoveryCodes = totp.CreateRecoveryCodes(); identity.EnableTotp(totp.ProtectSecret(secret), recoveryCodes.Select(totp.HashRecoveryCode));
        var browserSession = StartBrowserSession(identity, database, context, "totp-enrollment");
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "totp.enabled", "login-identity", identity.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession.Id, mfaSatisfied: true));
        return Results.Ok(new { recoveryCodes });
    }

    private static async Task<IResult> CompleteProfileMfaChallenge(
        TotpChallengeRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        Fylkren.Api.Platform.FylkrenOptions options,
        TotpService totp,
        CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaRequired || MfaSatisfied(user)) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context);
        if (string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 128 ||
            !Guid.TryParse(user.FindFirst("fylkren:session_id")?.Value, out var previousSessionId))
            return Results.Problem(statusCode: 401, title: "Invalid two-factor code.");
        var identity = await CurrentIdentity(user, database, cancellationToken);
        if (identity is null || !identity.TotpEnabled || identity.TotpSecret is null)
            return Results.Problem(statusCode: 401, title: "Invalid two-factor code.");

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var identityLockKey = BitConverter.ToInt64(identity.Id.ToByteArray(), 0);
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({identityLockKey})", cancellationToken);
        await database.Entry(identity).ReloadAsync(cancellationToken);
        var valid = false;
        try
        {
            valid = totp.TryVerify(totp.UnprotectSecret(identity.TotpSecret), request.Code, out var matchedTimeStep) &&
                identity.ConsumeTotpTimeStep(matchedTimeStep);
        }
        catch { }
        if (!valid) valid = identity.ConsumeRecoveryCode(totp.HashRecoveryCode(request.Code));
        var now = DateTimeOffset.UtcNow;
        if (!valid || identity.IsAuthenticationLocked(now))
        {
            if (!valid) identity.RecordAuthenticationFailure(now);
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return Results.Problem(statusCode: 401, title: "Invalid two-factor code.");
        }

        identity.ClearAuthenticationFailures();
        identity.RecordSignIn(now);
        var previousSession = await database.BrowserSessions.SingleOrDefaultAsync(
            value => value.Id == previousSessionId && value.LoginIdentityId == identity.Id, cancellationToken);
        previousSession?.Revoke(now);
        var browserSession = StartBrowserSession(identity, database, context, "supplemental-totp", now);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId,
            "mfa.completed", "login-identity", identity.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme,
            CreatePrincipal(identity, browserSession.Id, now,
                directoryManaged: user.FindFirst("fylkren:directory_managed")?.Value == "true", mfaSatisfied: true));
        return Results.NoContent();
    }

    private static bool FreshPendingMfaSession(ClaimsPrincipal user)
    {
        if (MfaSatisfied(user)) return false;
        return long.TryParse(user.FindFirst("fylkren:session_started_at")?.Value, out var startedAt) &&
            DateTimeOffset.UtcNow - DateTimeOffset.FromUnixTimeSeconds(startedAt) <= TimeSpan.FromMinutes(5);
    }

    private static async Task<IResult> DisableTotp([FromBody] DisableTotpRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        var directoryManaged = await IsDirectoryManaged(identity.PersonId, database, cancellationToken);
        if (string.IsNullOrEmpty(request.Password) && !directoryManaged || request.Password?.Length > 128)
            return Results.Problem(statusCode: 400, title: "The password is incorrect.");
        if (!directoryManaged && passwordHasher.VerifyHashedPassword(identity, identity.PasswordHash, request.Password!) == PasswordVerificationResult.Failed ||
            directoryManaged && !MfaSatisfied(user))
            return Results.Problem(statusCode: 400, title: "Fresh authentication is required.");
        if (options.Authentication.MfaRequired && (!options.Authentication.WebAuthn.Enabled ||
            !await database.WebAuthnCredentials.AnyAsync(
                value => value.PersonId == identity.PersonId && value.IsActive, cancellationToken)))
            return Results.Conflict(new { error = "At least one multi-factor sign-in method must remain active." });
        identity.DisableTotp();
        var browserSession = StartBrowserSession(identity, database, context, "totp-removal");
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "totp.disabled", "login-identity", identity.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession.Id, mfaSatisfied: MfaSatisfied(user)));
        return Results.NoContent();
    }
}
