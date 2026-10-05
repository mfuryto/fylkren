using System.Net.Mail;
using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static partial class IdentityEndpoints
{
    private static async Task<IResult> GetProfile(ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var identity = await CurrentIdentity(user, database, cancellationToken);
        return identity is null ? Results.Unauthorized() : Results.Ok(new { identity.Username, identity.Person.Email, identity.Person.DisplayName, identity.MustChangePassword, hasProfileImage = identity.Person.ProfileImage is not null });
    }

    private static async Task<IResult> UpdateProfile(UpdateProfileRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "Profile information is managed by the directory service." });
        var displayName = (request.DisplayName ?? "").Trim(); var email = (request.Email ?? "").Trim();
        if (displayName.Length is < 2 or > 200 || !MailAddress.TryCreate(email, out _)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["profile"] = ["The name or email address is invalid."] });
        var emailChanged = !string.Equals(identity.Person.Email, email, StringComparison.OrdinalIgnoreCase);
        if (emailChanged &&
            !VerifyCurrentPassword(identity, request.CurrentPassword, passwordHasher))
            return Results.Problem(statusCode: 400, title: "The current password is incorrect.");
        if (string.Equals(identity.Username, email, StringComparison.OrdinalIgnoreCase)) return Results.Conflict(new { error = "The email address cannot be identical to the username." });
        if (await database.People.AnyAsync(value => value.Id != identity.PersonId && value.NormalizedEmail == email.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The email address is already in use." });
        if (await database.LoginIdentities.AnyAsync(value => value.Id != identity.Id && value.NormalizedUsername == email.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The email address is already used as a username." });
        identity.Person.UpdateWithEmail(displayName, identity.Person.IsActive, email);
        if (emailChanged) identity.AdvanceSecurityVersion();
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "profile.updated", "person", identity.PersonId, DateTimeOffset.UtcNow));
        var browserSession = emailChanged ? StartBrowserSession(identity, database, context, "profile-reauthentication") : null;
        await database.SaveChangesAsync(cancellationToken);
        // A display-name-only edit is not re-authentication and must not restart the
        // absolute session lifetime. Email changes require the current password and
        // advance the security version, so that path deliberately renews this session.
        if (emailChanged)
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession!.Id));
        return Results.Ok(new { identity.Username, identity.Person.DisplayName, identity.MustChangePassword, hasProfileImage = identity.Person.ProfileImage is not null });
    }

    private static async Task<IResult> ChangePassword(ChangePasswordRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, IPasswordHasher<LoginIdentity> passwordHasher, PasswordSecurityPolicy passwordPolicy, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken)) return Results.Conflict(new { error = "The password is managed by the directory service." });
        if (string.IsNullOrEmpty(request.CurrentPassword) || string.IsNullOrEmpty(request.NewPassword)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = ["Enter both the current and new password."] });
        if (passwordHasher.VerifyHashedPassword(identity, identity.PasswordHash, request.CurrentPassword) == PasswordVerificationResult.Failed) return Results.Problem(statusCode: 400, title: "The current password is incorrect.");
        if (request.CurrentPassword == request.NewPassword) return Results.ValidationProblem(new Dictionary<string, string[]> { ["newPassword"] = ["The new password must be different from the current password."] });
        if (passwordPolicy.Validate(request.NewPassword, identity.Username, identity.Person.DisplayName, identity.Person.Email) is { } passwordError)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["newPassword"] = [passwordError] });
        identity.SetPasswordHash(passwordHasher.HashPassword(identity, request.NewPassword));
        var browserSession = StartBrowserSession(identity, database, context, "password-change");
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "password.changed", "login-identity", identity.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession.Id));
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateProfileImage(ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        var form = await context.Request.ReadFormAsync(cancellationToken); var image = form.Files.GetFile("image");
        var validatedImage = await SafeImageUpload.ReadAsync(image, cancellationToken);
        if (validatedImage is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["image"] = ["Select a valid JPEG, PNG, or WebP image no larger than 2 MB. The file contents must match the file type."] });
        identity.Person.SetProfileImage(validatedImage.Bytes, validatedImage.ContentType);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "profile-image.updated", "person", identity.PersonId, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteProfileImage(ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        await antiforgery.ValidateRequestAsync(context);
        var identity = await CurrentIdentity(user, database, cancellationToken); if (identity is null) return Results.Unauthorized();
        identity.Person.SetProfileImage(null, null);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "profile-image.removed", "person", identity.PersonId, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken); return Results.NoContent();
    }

    private static async Task<IResult> GetProfileImage(ClaimsPrincipal user, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        var identity = await CurrentIdentity(user, database, cancellationToken);
        if (identity?.Person.ProfileImage is null) return Results.NotFound();
        var contentType = identity.Person.ProfileImageContentType ?? "application/octet-stream";
        context.Response.Headers.ContentDisposition = $"inline; filename=\"profile-image{SafeImageUpload.DownloadExtension(contentType)}\"";
        return Results.File(identity.Person.ProfileImage, contentType, enableRangeProcessing: false);
    }

    private sealed record UpdateProfileRequest(string? DisplayName, string? Email, string? CurrentPassword);
    private sealed record ChangePasswordRequest(string? CurrentPassword, string? NewPassword);
}
