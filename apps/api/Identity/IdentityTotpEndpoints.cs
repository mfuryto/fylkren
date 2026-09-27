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
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Tofaktor forvaltes av katalogtjenesten." });
        if (!VerifyCurrentPassword(identity, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "Gjeldende passord er feil.");
        var secret = totp.CreateSecret();
        var branding = await database.BrandingSettings.AsNoTracking().Select(value => new { value.ProductName, value.InstanceName }).SingleAsync(cancellationToken);
        return Results.Ok(new { secret, setupToken = totp.CreateSetupToken(identity.Id, identity.SecurityVersion, secret), provisioningUri = totp.ProvisioningUri(branding.ProductName, branding.InstanceName, identity.Username, secret) });
    }

    private static async Task<IResult> ConfirmTotpSetup(TotpSetupRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, TotpService totp, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Tofaktor forvaltes av katalogtjenesten." });
        if (string.IsNullOrWhiteSpace(request.SetupToken) || request.SetupToken.Length > 4096 ||
            string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 128)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["Oppsettet eller koden er ugyldig. Start på nytt."] });
        (Guid IdentityId, long SecurityVersion, string Secret) setup;
        try { setup = totp.ReadSetupToken(request.SetupToken); }
        catch { return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["Oppsettet er ugyldig eller utløpt. Start på nytt."] }); }
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var identityLockKey = BitConverter.ToInt64(identity.Id.ToByteArray(), 0);
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({identityLockKey})", cancellationToken);
        await database.Entry(identity).ReloadAsync(cancellationToken);
        if (setup.IdentityId != identity.Id || setup.SecurityVersion != identity.SecurityVersion)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["Oppsettet er ikke lenger gyldig. Start på nytt."] });
        var secret = setup.Secret;
        if (!totp.Verify(secret, request.Code)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["code"] = ["Koden kunne ikke bekreftes."] });
        var recoveryCodes = totp.CreateRecoveryCodes(); identity.EnableTotp(totp.ProtectSecret(secret), recoveryCodes.Select(totp.HashRecoveryCode));
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "totp.enabled", "login-identity", identity.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity));
        return Results.Ok(new { recoveryCodes });
    }

    private static async Task<IResult> DisableTotp([FromBody] DisableTotpRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context); var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Tofaktor forvaltes av katalogtjenesten." });
        if (string.IsNullOrEmpty(request.Password) || request.Password.Length > 128)
            return Results.Problem(statusCode: 400, title: "Passordet er feil.");
        if (passwordHasher.VerifyHashedPassword(identity, identity.PasswordHash, request.Password) == PasswordVerificationResult.Failed) return Results.Problem(statusCode: 400, title: "Passordet er feil.");
        identity.DisableTotp(); database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "totp.disabled", "login-identity", identity.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity));
        return Results.NoContent();
    }
}
