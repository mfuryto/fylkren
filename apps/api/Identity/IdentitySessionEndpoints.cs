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
    private static async Task<IResult> GetSession(ClaimsPrincipal user, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, CancellationToken cancellationToken)
    {
        if (user.Identity?.IsAuthenticated != true || !Guid.TryParse(user.FindFirstValue(ClaimTypes.NameIdentifier), out var identityId))
            return Results.Ok(new { authenticated = false, username = (string?)null, personId = (string?)null, displayName = (string?)null, isPlatformManager = false, mustChangePassword = false, hasProfileImage = false, isDirectoryManaged = false, canPlan = false, canApproveWork = false });
        var identity = await database.LoginIdentities.Include(value => value.Person).SingleOrDefaultAsync(value => value.Id == identityId, cancellationToken);
        if (identity is null || !identity.IsActive || !identity.Person.IsActive || (!identity.IsPlatformManager && !await HasActiveAccess(identity.PersonId, database, cancellationToken))) return Results.Ok(new { authenticated = false, username = (string?)null, personId = (string?)null, displayName = (string?)null, isPlatformManager = false, mustChangePassword = false, hasProfileImage = false, isDirectoryManaged = false, canPlan = false, canApproveWork = false });
        var now = DateTimeOffset.UtcNow; var canPlan = await database.RoleAssignments.AnyAsync(x => x.PersonId == identity.PersonId && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) && x.Role.IsActive && x.Role.OrganizationUnit.IsActive && x.Role.OrganizationUnit.Site.IsActive && (x.Role.CanPlan || x.Role.IsLeader || x.Role.HasLeaderAccess), cancellationToken);
        var hasOperationalRole = await database.RoleAssignments.AnyAsync(x => x.PersonId == identity.PersonId && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) && x.Role.IsActive && x.Role.OrganizationUnit.IsActive && x.Role.OrganizationUnit.Site.IsActive, cancellationToken)
            || await database.OrganizationUnitMemberships.AnyAsync(x => x.PersonId == identity.PersonId && x.OrganizationUnit.IsActive && x.Site.IsActive && x.Site.Memberships.Any(membership => membership.PersonId == identity.PersonId && membership.IsActive), cancellationToken);
        var canExecute = hasOperationalRole || await database.OrganizationUnitMemberships.AnyAsync(x => x.PersonId == identity.PersonId && x.OrganizationUnit.IsActive && x.Site.IsActive && x.Site.Memberships.Any(membership => membership.PersonId == identity.PersonId && membership.IsActive), cancellationToken);
        var managesSites = await database.SiteManagerAssignments.AnyAsync(x => x.PersonId == identity.PersonId && x.IsActive && x.Site.IsActive, cancellationToken);
        var canApproveWork = await database.RoleAssignments.AnyAsync(x => x.PersonId == identity.PersonId && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now) && x.Role.IsActive && x.Role.OrganizationUnit.IsActive && x.Role.OrganizationUnit.Site.IsActive && (x.Role.IsLeader || x.Role.HasLeaderAccess), cancellationToken);
        var isTopLevelLeader = await database.OrganizationUnits.AnyAsync(unit => unit.IsActive && unit.Site.IsActive && unit.IsSiteLeadership && unit.Roles.Any(role => role.IsActive && (role.IsLeader || role.HasLeaderAccess) && role.Assignments.Any(assignment => assignment.PersonId == identity.PersonId && assignment.IsActive && assignment.ValidFrom <= now && (assignment.ValidTo == null || assignment.ValidTo > now))), cancellationToken)
            || await database.OrganizationUnits.AnyAsync(unit => unit.IsActive && unit.Site.IsActive && unit.WorksAtParentLevel && unit.Parent != null && (unit.Parent.IsSiteLeadership || unit.Parent.IsSiteRoot) && unit.Roles.Any(role => role.IsLeader && role.IsActive && role.Assignments.Any(assignment => assignment.PersonId == identity.PersonId && assignment.CanLeadParentLevel && assignment.IsActive && assignment.ValidFrom <= now && (assignment.ValidTo == null || assignment.ValidTo > now))), cancellationToken);
        var administersSite = await database.Sites.AnyAsync(site => site.IsActive &&
            (site.ManagerAssignments.Any(value => value.PersonId == identity.PersonId && value.IsActive) ||
             site.OrganizationUnits.Any(unit => unit.IsActive && unit.IsSiteLeadership && unit.Roles.Any(role => role.IsActive && (role.IsLeader || role.HasLeaderAccess) && role.Assignments.Any(value => value.PersonId == identity.PersonId && value.IsActive && value.ValidFrom <= now && (value.ValidTo == null || value.ValidTo > now)))) ||
             site.OrganizationUnits.Any(unit => unit.IsActive && unit.WorksAtParentLevel && unit.Parent != null && (unit.Parent.IsSiteLeadership || unit.Parent.IsSiteRoot) && unit.Roles.Any(role => role.IsLeader && role.IsActive && role.Assignments.Any(value => value.PersonId == identity.PersonId && value.CanLeadParentLevel && value.IsActive && value.ValidFrom <= now && (value.ValidTo == null || value.ValidTo > now))))), cancellationToken);
        var isDirectoryManaged = await IsDirectoryManaged(identity.PersonId, database, cancellationToken);
        var hasArchiveAccess = await Fylkren.Api.InformationLifecycle.ArchiveAccess.Current(database, identity.PersonId).AnyAsync(cancellationToken);
        return Results.Ok(new { authenticated = true, username = identity.Username, email = identity.Person.Email, personId = identity.PersonId.ToString(), displayName = identity.Person.DisplayName, isPlatformManager = identity.IsPlatformManager, hasArchiveAccess, managesSites, administersSite, hasOperationalRole, canExecute, mustChangePassword = identity.MustChangePassword, hasProfileImage = identity.Person.ProfileImage is not null, isDirectoryManaged, twoFactorEnabled = options.Authentication.MfaEnabled && identity.TotpEnabled, canPlan, canApproveWork, isTopLevelLeader });
    }

    private static async Task<IResult> SignIn(
        SignInRequest request,
        FylkrenDbContext database,
        IPasswordHasher<LoginIdentity> passwordHasher,
        Fylkren.Api.Platform.FylkrenOptions options,
        TotpService totp,
        HttpContext context,
        CancellationToken cancellationToken)
    {
        if (!options.Authentication.LocalEnabled) return Results.NotFound();
        var username = request.Username?.Trim() ?? string.Empty;
        var password = request.Password ?? string.Empty;
        if (username.Length is < 1 or > 320 || password.Length is < 1 or > 128)
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");
        var normalizedUsername = username.ToUpperInvariant();
        var identity = await database.LoginIdentities
            .Include(value => value.Person)
            .SingleOrDefaultAsync(value => value.NormalizedUsername == normalizedUsername || value.Person.NormalizedEmail == normalizedUsername, cancellationToken);

        if (identity is null)
        {
            var placeholder = new LoginIdentity(Guid.Empty, Guid.Empty, "invalid", false, DateTimeOffset.UnixEpoch);
            passwordHasher.HashPassword(placeholder, password);
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");
        }

        var passwordResult = passwordHasher.VerifyHashedPassword(identity, identity.PasswordHash, password);
        var now = DateTimeOffset.UtcNow;
        var isEligible = identity.IsActive && identity.Person.IsActive &&
            !await IsDirectoryManaged(identity.PersonId, database, cancellationToken) &&
            (identity.IsPlatformManager || await HasActiveAccess(identity.PersonId, database, cancellationToken));
        if (passwordResult == PasswordVerificationResult.Failed)
        {
            var lockedUntil = now.AddMinutes(15);
            await database.LoginIdentities
                .Where(value => value.Id == identity.Id)
                .ExecuteUpdateAsync(update => update
                    .SetProperty(value => value.FailedAuthenticationCount, value => value.FailedAuthenticationCount + 1)
                    .SetProperty(value => value.AuthenticationLockedUntil, value =>
                        value.FailedAuthenticationCount + 1 >= 20 ? lockedUntil : value.AuthenticationLockedUntil),
                    cancellationToken);
        }
        if (!isEligible || passwordResult == PasswordVerificationResult.Failed || identity.IsAuthenticationLocked(now))
            return Results.Problem(statusCode: StatusCodes.Status401Unauthorized, title: "Invalid username or password");
        identity.ClearAuthenticationFailures();
        if (passwordResult == PasswordVerificationResult.SuccessRehashNeeded)
        {
            var mustChangePassword = identity.MustChangePassword;
            identity.SetPasswordHash(passwordHasher.HashPassword(identity, password), mustChangePassword);
        }
        await database.SaveChangesAsync(cancellationToken);

        if (options.Authentication.MfaEnabled && identity.TotpEnabled) return Results.Accepted(value: new { requiresTwoFactor = true, challengeToken = totp.CreateChallenge(identity.Id, identity.SecurityVersion, TimeSpan.FromMinutes(5)) });
        identity.RecordSignIn(now);
        await database.SaveChangesAsync(cancellationToken);
        var principal = CreatePrincipal(identity);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, principal);
        return Results.NoContent();
    }

    internal static async Task<bool> HasActiveAccess(Guid personId, FylkrenDbContext database, CancellationToken cancellationToken) =>
        await database.SiteMemberships.AnyAsync(value => value.PersonId == personId && value.IsActive && value.Site.IsActive, cancellationToken) ||
        await database.SiteManagerAssignments.AnyAsync(value => value.PersonId == personId && value.IsActive && value.Site.IsActive, cancellationToken) ||
        await Fylkren.Api.InformationLifecycle.ArchiveAccess.Current(database, personId).AnyAsync(cancellationToken);

    private static async Task<IResult> CompleteTwoFactorSignIn(TwoFactorSignInRequest request, FylkrenDbContext database, Fylkren.Api.Platform.FylkrenOptions options, TotpService totp, HttpContext context, CancellationToken cancellationToken)
    {
        if (!options.Authentication.MfaEnabled) return Results.NotFound();
        if (string.IsNullOrWhiteSpace(request.ChallengeToken) || request.ChallengeToken.Length > 4096 ||
            string.IsNullOrWhiteSpace(request.Code) || request.Code.Length > 128)
            return Results.Problem(statusCode: 401, title: "Invalid or expired two-factor challenge.");
        (Guid IdentityId, long SecurityVersion) challenge;
        try { challenge = totp.ReadChallenge(request.ChallengeToken); }
        catch { return Results.Problem(statusCode: 401, title: "Invalid or expired two-factor challenge."); }
        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var identityLockKey = BitConverter.ToInt64(challenge.IdentityId.ToByteArray(), 0);
        await database.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock({identityLockKey})", cancellationToken);
        var identity = await database.LoginIdentities.Include(value => value.Person).SingleOrDefaultAsync(value => value.Id == challenge.IdentityId && value.IsActive && value.Person.IsActive && value.TotpEnabled, cancellationToken);
        if (identity?.TotpSecret is null || identity.SecurityVersion != challenge.SecurityVersion || (!identity.IsPlatformManager && !await HasActiveAccess(identity.PersonId, database, cancellationToken))) return Results.Problem(statusCode: 401, title: "Invalid two-factor code.");
        var valid = false;
        try
        {
            valid = totp.TryVerify(totp.UnprotectSecret(identity.TotpSecret), request.Code, out var matchedTimeStep) &&
                identity.ConsumeTotpTimeStep(matchedTimeStep);
        }
        catch { }
        if (!valid)
        {
            var recoveryHash = totp.HashRecoveryCode(request.Code);
            valid = identity.ConsumeRecoveryCode(recoveryHash);
        }
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
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity));
        return Results.NoContent();
    }
}
