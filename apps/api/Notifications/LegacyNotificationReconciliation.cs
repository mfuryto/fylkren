using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Notifications;

// Upgrade-only drain. New business commands own activity/recipient snapshots;
// neither the SMTP worker nor ordinary requests scan security audit history.
internal static class LegacyNotificationReconciliation
{
    internal static readonly Guid CursorId = Guid.Parse("00000000-0000-0000-0000-000000000003");
    internal static async Task Run(FylkrenDbContext db, string publicUrl, CancellationToken ct)
    {
        while (true)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var cursor = await db.NotificationProjectionCursors.FromSqlInterpolated($"SELECT * FROM notification_projection_cursors WHERE id={CursorId} FOR UPDATE").SingleAsync(ct);
            await db.Entry(cursor).ReloadAsync(ct);
            if (cursor.ReconciledAt is not null) { await transaction.CommitAsync(ct); return; }
            // Wait for prior inserts and freeze this batch's source before establishing
            // the final cutover. Deployments must stop unsupported old API nodes first.
            await db.Database.ExecuteSqlRawAsync("LOCK TABLE audit_events IN SHARE ROW EXCLUSIVE MODE", ct);
            var events = await db.AuditEvents.AsNoTracking().Where(a => a.DomainEventId == null &&
                (a.OccurredAt > cursor.LastOccurredAt || a.OccurredAt == cursor.LastOccurredAt && a.Id.CompareTo(cursor.LastAuditEventId) > 0))
                .OrderBy(a => a.OccurredAt).ThenBy(a => a.Id).Take(100).ToListAsync(ct);
            foreach (var audit in events)
            {
                var kind = NotificationEventProjector.Kind(audit.EventType);
                if (kind is not null && audit.SiteId is Guid site)
                {
                    var destination = await NotificationEventProjector.NotificationSite(db, audit, site, kind, ct);
                    if (await NotificationEventProjector.Enabled(db, destination, kind, ct))
                        await NotificationEventProjector.Enqueue(db, audit, destination, kind, publicUrl, ct);
                }
                cursor.Advance(audit.OccurredAt, audit.Id);
            }
            if (events.Count == 0) cursor.CompleteReconciliation(DateTimeOffset.UtcNow);
            await db.SaveChangesAsync(ct); await transaction.CommitAsync(ct);
            if (events.Count == 0) return;
        }
    }
}
