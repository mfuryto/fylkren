using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace Fylkren.Api.Licensing;

internal static class SiteCapacityPolicy
{
    internal const int CommunityActiveSiteLimit = 3;
    internal const string LimitMessage = "Community tillater høyst 3 aktive sites. Deaktiver en site eller aktiver Enterprise-lisens før du legger til flere.";

    // All paths that increase the active-site count take this transaction-scoped lock.
    // It prevents two simultaneous requests from both passing the quota check.
    internal static async Task<IDbContextTransaction?> BeginAdditionAsync(
        FylkrenDbContext db, LicenseService license, CancellationToken ct)
    {
        var transaction = await db.Database.BeginTransactionAsync(ct);
        try
        {
            if (db.Database.IsNpgsql())
                await db.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(601128301)", ct);

            var status = await license.Current(db, ct);
            if (status.Edition == "community" &&
                await db.Sites.CountAsync(site => site.IsActive, ct) >= CommunityActiveSiteLimit)
            {
                await transaction.DisposeAsync();
                return null;
            }

            return transaction;
        }
        catch
        {
            await transaction.DisposeAsync();
            throw;
        }
    }
}
