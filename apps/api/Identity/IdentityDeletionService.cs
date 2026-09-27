using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

internal static class IdentityDeletionService
{
    internal static async Task RemoveAuthenticationAsync(
        IReadOnlyCollection<Guid> personIds,
        FylkrenDbContext database,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        if (personIds.Count == 0) return;

        database.WebAuthnCredentials.RemoveRange(
            await database.WebAuthnCredentials
                .Where(value => personIds.Contains(value.PersonId))
                .ToListAsync(cancellationToken));
        database.ExternalIdentityLinks.RemoveRange(
            await database.ExternalIdentityLinks
                .Where(value => personIds.Contains(value.PersonId))
                .ToListAsync(cancellationToken));

        var identities = await database.LoginIdentities
            .Where(value => personIds.Contains(value.PersonId))
            .ToListAsync(cancellationToken);
        var identityIds = identities.Select(value => value.Id).ToArray();
        var resetGrants = await database.PasswordResetGrants
            .Where(value => identityIds.Contains(value.LoginIdentityId) &&
                value.ConsumedAt == null && value.RevokedAt == null)
            .ToListAsync(cancellationToken);
        foreach (var grant in resetGrants) grant.Revoke(now);
        foreach (var identity in identities) identity.Delete();
    }
}
