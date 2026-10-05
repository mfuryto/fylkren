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
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Two-factor authentication is managed by the directory service." });
        if (!VerifyCurrentPassword(identity, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "The current password is incorrect.");
        var secret = totp.CreateSecret();
        var branding = await database.BrandingSettings.AsNoTracking().Select(value => new { value.ProductName, value.InstanceName }).SingleAsync(cancellationToken);
        return Results.Ok(new { secret, setupToken = totp.CreateSetupToken(identity.Id, identity.SecurityVersion, secret), provisioningUri = totp.ProvisioningUri(branding.ProductName, branding.InstanceName, identity.Username, secret) });
    }

    private static async Task<IResult> ConfirmTotpSetup(TotpSetupRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, TotpService totp, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Two-factor authentication is managed by the directory service." });
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
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession.Id));
        return Results.Ok(new { recoveryCodes });
    }

    private static async Task<IResult> DisableTotp([FromBody] DisableTotpRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Two-factor authentication is managed by the directory service." });
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
            return Results.Problem(statusCode: 400, title: "The password is incorrect.");
        if (passwordHasher.VerifyHashedPassword(identity, identity.PasswordHash, request.Password) == PasswordVerificationResult.Failed) return Results.Problem(statusCode: 400, title: "The password is incorrect.");
        identity.DisableTotp();
        var browserSession = StartBrowserSession(identity, database, context, "totp-removal");
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "totp.disabled", "login-identity", identity.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession.Id));
        return Results.NoContent();
    }
}
