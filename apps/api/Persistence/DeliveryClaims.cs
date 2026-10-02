using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class DeliveryClaims
{
    // Existing retry fields double as bounded leases; no second delivery queue.
    internal static Task<int> Notification(FylkrenDbContext db, Guid id, DateTimeOffset now, CancellationToken ct) =>
        db.NotificationOutboxMessages.Where(x => x.Id == id && x.Status == "pending" && x.NextAttemptAt <= now)
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.NextAttemptAt, now.AddMinutes(5)), ct);

    internal static Task<int> Webhook(FylkrenDbContext db, Guid id, DateTimeOffset now, CancellationToken ct) =>
        db.WebhookDeliveries.Where(x => x.Id == id && x.NextAttemptAt <= now &&
            (x.Status == "pending" || x.Status == "retry" || x.Status == "delivering" && x.LastAttemptAt < now.AddMinutes(-5)))
            .ExecuteUpdateAsync(setters => setters.SetProperty(x => x.Status, "delivering")
                .SetProperty(x => x.LastAttemptAt, now).SetProperty(x => x.AttemptCount, x => x.AttemptCount + 1), ct);
}
