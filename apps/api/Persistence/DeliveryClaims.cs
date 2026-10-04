using Microsoft.EntityFrameworkCore;
using Fylkren.Api.Federation;

namespace Fylkren.Api.Persistence;

internal static class DeliveryClaims
{
    // Existing retry fields double as bounded leases; no second delivery queue.
    internal static Task<int> Notification(FylkrenDbContext db, Guid id, DateTimeOffset now, CancellationToken ct) =>
        db.NotificationOutboxMessages.Where(x => x.Id == id && x.Status == "pending" && x.NextAttemptAt <= now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.NextAttemptAt, now.AddMinutes(5)), ct);

    internal static Task<int> Webhook(FylkrenDbContext db, Guid id, DateTimeOffset now, CancellationToken ct) =>
        db.WebhookDeliveries.Where(x => x.Id == id && x.AttemptCount >= 0 && x.AttemptCount < int.MaxValue && x.NextAttemptAt <= now &&
            (x.Status == "pending" || x.Status == "retry" || x.Status == "delivering" && x.LastAttemptAt < now.AddMinutes(-5)))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, "delivering")
                .SetProperty(x => x.LastAttemptAt, now).SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1), ct);

    internal static Task<int> Federation(FylkrenDbContext db, Guid id, DateTimeOffset now, CancellationToken ct) =>
        db.FederationOutboundMessages.Where(row => row.MessageId == id && row.AttemptCount >= 0 && row.AttemptCount < 6 &&
                (row.Status == "pending" || row.Status == "retrying") && row.NextAttemptAt <= now)
            .ExecuteUpdateAsync(setters => setters
                .SetProperty(row => row.Status, "retrying")
                .SetProperty(row => row.NextAttemptAt, now.AddSeconds(60))
                .SetProperty(row => row.AttemptCount, row => row.AttemptCount + 1), ct);
}
