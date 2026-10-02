using System.Security.Claims;
using Fido2NetLib;
using Fido2NetLib.Objects;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static class WebAuthnEndpoints
{
    public static IEndpointRouteBuilder MapWebAuthnEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/webauthn");
        group.MapGet("/credentials", List).RequireAuthorization();
        group.MapPost("/register/options", RegisterOptions).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPost("/register/complete", RegisterComplete).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapDelete("/credentials/{id:guid}", Delete).RequireAuthorization().RequireRateLimiting("authentication");
        group.MapPost("/login/options", LoginOptions)
            .AllowAnonymous()
            .RequireRateLimiting("authentication");
        group.MapPost("/login/complete", LoginComplete)
            .AllowAnonymous()
            .RequireRateLimiting("authentication");
        return endpoints;
    }

    private static async Task<IResult> List(
        ClaimsPrincipal user,
        FylkrenDbContext db,
        FylkrenOptions options,
        CancellationToken ct)
    {
        if (!options.Authentication.WebAuthn.Enabled)
            return Results.NotFound();
        if (!PersonId(user, out var personId) || await EligibleLocalIdentity(personId, db, ct) is null)
            return Results.Unauthorized();

        var credentials = await db.WebAuthnCredentials
            .AsNoTracking()
            .Where(credential => credential.PersonId == personId && credential.IsActive)
            .OrderBy(credential => credential.CreatedAt)
            .Select(credential => new
            {
                credential.Id,
                credential.Name,
                credential.CreatedAt,
                credential.LastUsedAt
            })
            .ToListAsync(ct);
        return Results.Ok(credentials);
    }

    private static async Task<IResult> RegisterOptions(
        NameRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext db,
        FylkrenOptions options,
        IPasswordHasher<LoginIdentity> passwordHasher,
        IFido2 fido2,
        WebAuthnFlowService flow,
        CancellationToken ct)
    {
        if (!options.Authentication.WebAuthn.Enabled)
            return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context);

        var name = request.Name?.Trim() ?? string.Empty;
        if (!PersonId(user, out var personId) || name.Length is < 2 or > 100)
            return Results.BadRequest();
        var login = await EligibleLocalIdentity(personId, db, ct);
        if (login is null)
            return Results.Unauthorized();
        if (!IdentityEndpoints.VerifyCurrentPassword(login, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "The current password is incorrect.");

        var existing = await db.WebAuthnCredentials
            .AsNoTracking()
            .Where(credential => credential.PersonId == personId && credential.IsActive)
            .Select(credential => new PublicKeyCredentialDescriptor(credential.CredentialId))
            .ToListAsync(ct);
        var credentialOptions = fido2.RequestNewCredential(new RequestNewCredentialParams
        {
            User = new Fido2User
            {
                Id = personId.ToByteArray(),
                Name = login.Username,
                DisplayName = login.Person.DisplayName
            },
            ExcludeCredentials = existing,
            AuthenticatorSelection = AuthenticatorSelection.Default,
            AttestationPreference = AttestationConveyancePreference.None
        });
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddMinutes(5);
        var grant = new WebAuthnFlowGrant(Guid.NewGuid(), "register", now, expiresAt);
        db.WebAuthnFlowGrants.Add(grant);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new
        {
            options = credentialOptions,
            token = flow.Protect(grant.Id, personId, login.SecurityVersion, credentialOptions.ToJson(), name, expiresAt)
        });
    }

    private static async Task<IResult> RegisterComplete(
        [FromBody] RegisterCompleteRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext db,
        FylkrenOptions options,
        IFido2 fido2,
        WebAuthnFlowService flow,
        CancellationToken ct)
    {
        if (!options.Authentication.WebAuthn.Enabled)
            return Results.NotFound();
        await antiforgery.ValidateRequestAsync(context);
        if (!PersonId(user, out var personId))
            return Results.Unauthorized();
        if (string.IsNullOrWhiteSpace(request.Token) ||
            request.Token.Length > 32768 ||
            request.Credential is null)
            return Results.BadRequest();

        (Guid grantId, Guid person, long securityVersion, string json, string? name) state;
        try
        {
            state = flow.Read(request.Token);
        }
        catch
        {
            return Results.BadRequest();
        }

        if (state.person != personId)
            return Results.Forbid();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var login = await EligibleLocalIdentity(personId, db, ct);
        if (login is null)
            return Results.Unauthorized();
        await LockIdentity(login, db, ct);
        if (login.SecurityVersion != state.securityVersion || await EligibleLocalIdentity(personId, db, ct) is null)
            return Results.BadRequest();

        var credentialOptions = CredentialCreateOptions.FromJson(state.json);
        var result = await fido2.MakeNewCredentialAsync(new MakeNewCredentialParams
        {
            AttestationResponse = request.Credential,
            OriginalOptions = credentialOptions,
            IsCredentialIdUniqueToUserCallback = async (args, token) =>
                !await db.WebAuthnCredentials.AnyAsync(
                    credential => credential.CredentialId == args.CredentialId,
                    token)
        }, ct);

        var now = DateTimeOffset.UtcNow;
        if (!await ConsumeFlowGrant(state.grantId, "register", now, db, ct))
            return Results.BadRequest();
        db.WebAuthnCredentials.Add(new WebAuthnCredential(
            Guid.NewGuid(),
            personId,
            result.Id,
            result.PublicKey,
            result.User.Id,
            result.SignCount,
            state.name ?? "Passkey",
            now));
        login.AdvanceSecurityVersion();
        db.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(), null, personId,
            "webauthn.registered", "person", personId, now));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            IdentityEndpoints.CreatePrincipal(login));
        return Results.NoContent();
    }

    private static async Task<IResult> LoginOptions(
        NameRequest request,
        FylkrenDbContext db,
        FylkrenOptions options,
        IFido2 fido2,
        WebAuthnFlowService flow,
        CancellationToken ct)
    {
        if (!options.Authentication.WebAuthn.Enabled)
            return Results.NotFound();
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 1 or > 320)
            return Results.Problem(statusCode: 401);

        var normalized = name.ToUpperInvariant();
        var candidate = await db.LoginIdentities
            .AsNoTracking()
            .FirstOrDefaultAsync(identity =>
                (identity.NormalizedUsername == normalized || identity.Person.NormalizedEmail == normalized) &&
                identity.IsActive &&
                identity.Person.IsActive,
                ct);
        var login = candidate is null
            ? null
            : await EligibleLocalIdentity(candidate.PersonId, db, ct);
        if (login is null)
            return Results.Problem(statusCode: 401);

        var credentials = await db.WebAuthnCredentials
            .AsNoTracking()
            .Where(credential => credential.PersonId == login.PersonId && credential.IsActive)
            .Select(credential => new PublicKeyCredentialDescriptor(credential.CredentialId))
            .ToListAsync(ct);
        if (credentials.Count == 0)
            return Results.Problem(statusCode: 401);

        var assertionOptions = fido2.GetAssertionOptions(new GetAssertionOptionsParams
        {
            AllowedCredentials = credentials,
            UserVerification = UserVerificationRequirement.Required
        });
        var now = DateTimeOffset.UtcNow;
        var expiresAt = now.AddMinutes(5);
        var grant = new WebAuthnFlowGrant(Guid.NewGuid(), "login", now, expiresAt);
        db.WebAuthnFlowGrants.Add(grant);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new
        {
            options = assertionOptions,
            token = flow.Protect(grant.Id, login.PersonId, login.SecurityVersion, assertionOptions.ToJson(), null, expiresAt)
        });
    }

    private static async Task<IResult> LoginComplete(
        [FromBody] LoginCompleteRequest request,
        FylkrenDbContext db,
        FylkrenOptions options,
        IFido2 fido2,
        WebAuthnFlowService flow,
        HttpContext context,
        CancellationToken ct)
    {
        if (!options.Authentication.WebAuthn.Enabled)
            return Results.NotFound();
        if (string.IsNullOrWhiteSpace(request.Token) ||
            request.Token.Length > 32768 ||
            request.Credential is null)
            return Results.Problem(statusCode: 401);

        (Guid grantId, Guid person, long securityVersion, string json, string? name) state;
        try
        {
            state = flow.Read(request.Token);
        }
        catch
        {
            return Results.Problem(statusCode: 401);
        }

        var login = await EligibleLocalIdentity(state.person, db, ct);
        if (login is null)
            return Results.Problem(statusCode: 401);
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        await LockIdentity(login, db, ct);
        if (login.SecurityVersion != state.securityVersion || await EligibleLocalIdentity(state.person, db, ct) is null)
            return Results.Problem(statusCode: 401);
        var credential = await db.WebAuthnCredentials.FirstOrDefaultAsync(value =>
            value.PersonId == state.person &&
            value.IsActive &&
            value.CredentialId == request.Credential.RawId,
            ct);
        if (credential is null)
            return Results.Problem(statusCode: 401);

        var assertionOptions = AssertionOptions.FromJson(state.json);
        var result = await fido2.MakeAssertionAsync(new MakeAssertionParams
        {
            AssertionResponse = request.Credential,
            OriginalOptions = assertionOptions,
            StoredPublicKey = credential.PublicKey,
            StoredSignatureCounter = credential.SignCount,
            IsUserHandleOwnerOfCredentialIdCallback = (args, _) => Task.FromResult(
                args.UserHandle.SequenceEqual(credential.UserHandle) &&
                args.CredentialId.SequenceEqual(credential.CredentialId))
        }, ct);

        var now = DateTimeOffset.UtcNow;
        if (!await ConsumeFlowGrant(state.grantId, "login", now, db, ct))
            return Results.Problem(statusCode: 401);
        credential.Used(result.SignCount, now);
        login.ClearAuthenticationFailures();
        login.RecordSignIn(now);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            IdentityEndpoints.CreatePrincipal(login));
        return Results.NoContent();
    }

    private static async Task<bool> ConsumeFlowGrant(
        Guid grantId,
        string purpose,
        DateTimeOffset now,
        FylkrenDbContext db,
        CancellationToken ct) =>
        await db.WebAuthnFlowGrants
            .Where(value => value.Id == grantId && value.Purpose == purpose &&
                value.ConsumedAt == null && value.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(value => value.ConsumedAt, (DateTimeOffset?)now), ct) == 1;

    private static async Task<IResult> Delete(
        Guid id,
        [FromBody] ReauthenticationRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext db,
        IPasswordHasher<LoginIdentity> passwordHasher,
        CancellationToken ct)
    {
        await antiforgery.ValidateRequestAsync(context);
        if (!PersonId(user, out var personId))
            return Results.Unauthorized();
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var login = await EligibleLocalIdentity(personId, db, ct);
        if (login is null)
            return Results.Unauthorized();
        await LockIdentity(login, db, ct);
        if (await EligibleLocalIdentity(personId, db, ct) is null)
            return Results.Unauthorized();
        if (!IdentityEndpoints.VerifyCurrentPassword(login, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "The current password is incorrect.");
        var credential = await db.WebAuthnCredentials.SingleOrDefaultAsync(value =>
            value.Id == id && value.PersonId == personId && value.IsActive,
            ct);
        if (credential is null)
            return Results.NotFound();

        credential.Deactivate();
        login.AdvanceSecurityVersion();
        db.AuditEvents.Add(new AuditEvent(
            Guid.NewGuid(), null, personId,
            "webauthn.removed", "person", personId, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        await context.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            IdentityEndpoints.CreatePrincipal(login));
        return Results.NoContent();
    }

    private static async Task LockIdentity(LoginIdentity login, FylkrenDbContext db, CancellationToken ct)
    {
        var key = BitConverter.ToInt64(login.Id.ToByteArray(), 0);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({key})", ct);
        await db.Entry(login).ReloadAsync(ct);
    }

    private static async Task<LoginIdentity?> EligibleLocalIdentity(
        Guid personId,
        FylkrenDbContext db,
        CancellationToken ct)
    {
        var identity = await db.LoginIdentities
            .Include(value => value.Person)
            .SingleOrDefaultAsync(value =>
                value.PersonId == personId &&
                value.IsActive &&
                value.Person.IsActive,
                ct);
        if (identity is null || await db.ExternalIdentityLinks.AnyAsync(link =>
                link.PersonId == personId &&
                link.IsActive &&
                (link.Provider == "ad" || link.Provider == "ldap"), ct))
            return null;
        return identity.IsPlatformManager || await IdentityEndpoints.HasActiveAccess(personId, db, ct)
            ? identity
            : null;
    }

    private static bool PersonId(ClaimsPrincipal user, out Guid id) =>
        Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);

    private sealed record NameRequest(string? Name, string? CurrentPassword = null);
    private sealed record ReauthenticationRequest(string? CurrentPassword);
    private sealed record RegisterCompleteRequest(
        string? Token,
        AuthenticatorAttestationRawResponse? Credential);
    private sealed record LoginCompleteRequest(
        string? Token,
        AuthenticatorAssertionRawResponse? Credential);
}
