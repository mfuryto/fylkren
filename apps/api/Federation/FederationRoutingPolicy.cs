using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationRoutingPolicy
{
    internal static Task<bool> IsEnabledAsync(FylkrenDbContext db, CancellationToken ct) =>
        db.FederationRoutingSettings.AsNoTracking()
            .Where(value => value.Key == FederationRoutingSettings.SingletonKey)
            .Select(value => value.Enabled)
            .SingleAsync(ct);
}
