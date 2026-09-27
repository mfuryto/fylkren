using System.Security.Cryptography;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

internal static class PasswordResetService
{
    internal static async Task<(PasswordResetGrant Grant, string Code)> CreateAsync(
        LoginIdentity identity,
        Guid actorPersonId,
        FylkrenDbContext database,
        DateTimeOffset now,
        CancellationToken cancellationToken)
    {
        var existing = await database.PasswordResetGrants
            .Where(value => value.LoginIdentityId == identity.Id && value.ConsumedAt == null && value.RevokedAt == null && value.ExpiresAt > now)
            .ToListAsync(cancellationToken);
        foreach (var grant in existing) grant.Revoke(now);

        var rawCode = Convert.ToHexString(RandomNumberGenerator.GetBytes(16));
        var displayCode = string.Join('-', Enumerable.Range(0, 4).Select(index => rawCode.Substring(index * 8, 8)));
        var created = new PasswordResetGrant(
            Guid.NewGuid(), identity.Id, actorPersonId, PasswordResetGrant.Hash(rawCode), now, now.AddMinutes(30));
        database.PasswordResetGrants.Add(created);
        return (created, displayCode);
    }
}
