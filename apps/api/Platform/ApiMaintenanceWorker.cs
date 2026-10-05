using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal sealed class ApiMaintenanceWorker(
    IServiceScopeFactory scopeFactory,
    FylkrenOptions options,
    ILogger<ApiMaintenanceWorker> logger) : BackgroundService
{
    internal static readonly TimeSpan IdempotencyRetention = TimeSpan.FromDays(7);
    internal static readonly TimeSpan InactiveBrowserSessionRetention = TimeSpan.FromDays(1);
    internal const int FederationRetentionBatchSize = 10_000;
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopeFactory.CreateAsyncScope();
                var database = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                var removed = await database.ApiIdempotencyRecords
                    .Where(record => record.CreatedAt < DateTimeOffset.UtcNow - IdempotencyRetention)
                    .ExecuteDeleteAsync(stoppingToken);
                if (removed > 0)
                    logger.LogInformation(
                        "Removed {RemovedCount} expired API idempotency records",
                        removed);
                var removedWebAuthnFlows = await database.WebAuthnFlowGrants
                    .Where(grant => grant.ExpiresAt < DateTimeOffset.UtcNow - TimeSpan.FromDays(1))
                    .ExecuteDeleteAsync(stoppingToken);
                if (removedWebAuthnFlows > 0)
                    logger.LogInformation(
                        "Removed {RemovedCount} expired WebAuthn flow grants",
                        removedWebAuthnFlows);
                var inactiveSessionCutoff = DateTimeOffset.UtcNow - InactiveBrowserSessionRetention;
                var removedBrowserSessions = await database.BrowserSessions
                    .Where(session => session.ExpiresAt < inactiveSessionCutoff ||
                        session.RevokedAt != null && session.RevokedAt < inactiveSessionCutoff)
                    .ExecuteDeleteAsync(stoppingToken);
                if (removedBrowserSessions > 0)
                    logger.LogInformation(
                        "Removed {RemovedCount} inactive browser-session records",
                        removedBrowserSessions);
                var removedProbeNonces = await database.FederationProbeNonces
                    .Where(probe => probe.ReceivedAt < DateTimeOffset.UtcNow - TimeSpan.FromDays(7))
                    .ExecuteDeleteAsync(stoppingToken);
                if (removedProbeNonces > 0)
                    logger.LogInformation("Removed {RemovedCount} expired federation probe nonces", removedProbeNonces);
                await RemoveExpiredFederationHistory(database, DateTimeOffset.UtcNow,
                    options.Federation.RetentionDays, logger, stoppingToken);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogWarning(exception, "API maintenance failed");
            }

            await Task.Delay(Interval, stoppingToken);
        }
    }

    internal static async Task RemoveExpiredFederationHistory(FylkrenDbContext database,
        DateTimeOffset now, int retentionDays, ILogger logger, CancellationToken ct)
    {
        var cutoff = now.AddDays(-retentionDays);
        await using var transaction = await database.Database.BeginTransactionAsync(ct);
        // Serialize housekeeping with Site/root hold and archive administration before
        // the fresh delete statements. An in-flight hold must not lose its evidence.
        var workIds = await database.Database.SqlQuery<Guid>($$"""
            SELECT w.id AS "Value" FROM work_items w
            WHERE NOT fylkren_preserved_work(w.id) AND w.status IN ('completed','rejected','cancelled','reassigned') AND
              (EXISTS (SELECT 1 FROM federation_outbound_messages m WHERE m.origin_resource_id=w.id AND m.source_site_id=w.site_id AND m.status='delivered' AND m.delivered_at < {{cutoff}})
               OR EXISTS (SELECT 1 FROM federation_inbound_receipts r WHERE r.local_work_item_id=w.id AND r.destination_site_id=w.site_id AND r.received_at < {{cutoff}}))
            ORDER BY w.id LIMIT {{FederationRetentionBatchSize}}
            """).ToArrayAsync(ct);
        await database.Sites.FromSqlInterpolated($"SELECT s.* FROM sites s WHERE s.id IN (SELECT site_id FROM work_items WHERE id = ANY({workIds})) ORDER BY s.id FOR SHARE OF s").AsNoTracking().ToListAsync(ct);
        await database.Database.SqlQuery<Guid>($$"""
            WITH RECURSIVE chain AS (
              SELECT id,parent_work_item_id,site_id FROM work_items WHERE id = ANY({{workIds}})
              UNION SELECT p.id,p.parent_work_item_id,p.site_id FROM work_items p JOIN chain c ON p.id=c.parent_work_item_id AND p.site_id=c.site_id)
            SELECT w.id AS "Value" FROM work_items w JOIN chain c ON c.id=w.id ORDER BY w.id FOR SHARE OF w
            """).ToListAsync(ct);
        var removedOutbound = await database.Database.ExecuteSqlInterpolatedAsync($$"""
            DELETE FROM federation_outbound_messages
            WHERE message_id IN (
                SELECT message.message_id
                FROM federation_outbound_messages message
                JOIN work_items work ON work.id = message.origin_resource_id
                WHERE work.id = ANY({{workIds}}) AND work.site_id = message.source_site_id AND message.status = 'delivered' AND message.delivered_at < {{cutoff}}
                  AND work.status IN ('completed', 'rejected', 'cancelled', 'reassigned')
                  AND NOT fylkren_preserved_work(work.id)
                ORDER BY message.delivered_at, message.message_id
                LIMIT {{FederationRetentionBatchSize}}
            )
            """, ct);
        var removedReceipts = await database.Database.ExecuteSqlInterpolatedAsync($$"""
            DELETE FROM federation_inbound_receipts
            WHERE (peer_instance_id, message_id) IN (
                SELECT receipt.peer_instance_id, receipt.message_id
                FROM federation_inbound_receipts receipt
                JOIN work_items work ON work.id = receipt.local_work_item_id
                WHERE work.id = ANY({{workIds}}) AND work.site_id = receipt.destination_site_id AND receipt.received_at < {{cutoff}}
                  AND work.status IN ('completed', 'rejected', 'cancelled', 'reassigned')
                  AND NOT fylkren_preserved_work(work.id)
                ORDER BY receipt.received_at, receipt.peer_instance_id, receipt.message_id
                LIMIT {{FederationRetentionBatchSize}}
            )
            """, ct);
        await transaction.CommitAsync(ct);
        // Protocol housekeeping never acts as the security audit retention policy.
        if (removedOutbound + removedReceipts > 0)
            logger.LogInformation(
                "Removed expired federation transport history: {OutboundCount} outbound, {ReceiptCount} receipts",
                removedOutbound, removedReceipts);
    }
}
