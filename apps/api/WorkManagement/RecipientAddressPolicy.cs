using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

// A site ID by itself is only meaningful inside this installation. Existing
// callers may omit the instance ID; an explicitly remote address must never
// fall through to the local-site request path before federation is routable.
internal static class RecipientAddressPolicy
{
    internal static async Task<IResult?> RejectRemoteAsync(Guid? targetInstanceId,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (targetInstanceId is null) return null;
        var localInstanceId = await db.InstanceIdentities.AsNoTracking()
            .Where(value => value.Key == 1)
            .Select(value => value.InstanceId)
            .SingleAsync(ct);
        return targetInstanceId == localInstanceId ? null : Results.Conflict(new
        {
            error = "federated_recipient_not_routable",
            message = "Mottakersiten tilhører en annen Fylkren-instans. Federert sending er ikke tilgjengelig ennå."
        });
    }
}
