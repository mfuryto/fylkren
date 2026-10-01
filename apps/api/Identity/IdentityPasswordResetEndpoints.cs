using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static partial class IdentityEndpoints
{
    private static async Task<IResult> CompletePasswordReset(
        CompletePasswordResetRequest request,
        FylkrenDbContext database,
        IPasswordHasher<LoginIdentity> passwordHasher,
        PasswordSecurityPolicy passwordPolicy,
        CancellationToken cancellationToken)
    {
        var code = PasswordResetGrant.Normalize(request.ResetCode ?? string.Empty);
        if (code.Length != 32)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["resetCode"] = ["The one-time code is invalid or expired."] });

        await using var transaction = await database.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTimeOffset.UtcNow;
        var hash = PasswordResetGrant.Hash(code);
        var candidates = await database.PasswordResetGrants
            .Include(value => value.LoginIdentity).ThenInclude(value => value.Person)
            .Where(value => value.ConsumedAt == null && value.RevokedAt == null && value.ExpiresAt > now && value.CodeHash == hash)
            .ToListAsync(cancellationToken);
        var grant = candidates.SingleOrDefault(value => value.Matches(code, now));
        var identity = grant?.LoginIdentity;
        if (grant is null || identity is null || !identity.IsActive || !identity.Person.IsActive || identity.Person.IsDeleted)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["resetCode"] = ["The one-time code is invalid or expired."] });
        if (await IsDirectoryManaged(identity.PersonId, database, cancellationToken))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["resetCode"] = ["The one-time code is invalid or expired."] });
        if (passwordPolicy.Validate(request.NewPassword, identity.Username, identity.Person.DisplayName, identity.Person.Email) is { } passwordError)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["newPassword"] = [passwordError] });

        var consumed = await database.PasswordResetGrants
            .Where(value => value.Id == grant.Id && value.ConsumedAt == null && value.RevokedAt == null && value.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(value => value.ConsumedAt, (DateTimeOffset?)now), cancellationToken);
        if (consumed != 1)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["resetCode"] = ["The one-time code is invalid or expired."] });
        await database.PasswordResetGrants
            .Where(value => value.Id != grant.Id && value.LoginIdentityId == identity.Id &&
                value.ConsumedAt == null && value.RevokedAt == null && value.ExpiresAt > now)
            .ExecuteUpdateAsync(update => update.SetProperty(value => value.RevokedAt, (DateTimeOffset?)now), cancellationToken);
        identity.SetPasswordHash(passwordHasher.HashPassword(identity, request.NewPassword!));
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, identity.PersonId, "password.reset-completed", "login-identity", identity.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return Results.NoContent();
    }
}
