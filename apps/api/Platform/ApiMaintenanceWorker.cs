using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal sealed class ApiMaintenanceWorker(
    IServiceScopeFactory scopeFactory,
    FylkrenOptions options,
    ILogger<ApiMaintenanceWorker> logger) : BackgroundService
{
    internal static readonly TimeSpan IdempotencyRetention = TimeSpan.FromDays(7);
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
        var removedOutbound = await database.Database.ExecuteSqlInterpolatedAsync($$"""
            DELETE FROM federation_outbound_messages
            WHERE message_id IN (
                SELECT message.message_id
                FROM federation_outbound_messages message
                JOIN work_items work ON work.id = message.origin_resource_id
                WHERE message.status = 'delivered' AND message.delivered_at < {{cutoff}}
                  AND work.status IN ('completed', 'rejected', 'cancelled', 'reassigned')
                  AND NOT EXISTS (SELECT 1 FROM information_lifecycle life WHERE life.resource_type = 'work_item'
                    AND life.resource_id = work.id AND (life.is_held OR life.stage <> 'active'))
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
                WHERE receipt.received_at < {{cutoff}}
                  AND work.status IN ('completed', 'rejected', 'cancelled', 'reassigned')
                  AND NOT EXISTS (SELECT 1 FROM information_lifecycle life WHERE life.resource_type = 'work_item'
                    AND life.resource_id = work.id AND (life.is_held OR life.stage <> 'active'))
                ORDER BY receipt.received_at, receipt.peer_instance_id, receipt.message_id
                LIMIT {{FederationRetentionBatchSize}}
            )
            """, ct);
        // Protocol housekeeping never acts as the security audit retention policy.
        if (removedOutbound + removedReceipts > 0)
            logger.LogInformation(
                "Removed expired federation transport history: {OutboundCount} outbound, {ReceiptCount} receipts",
                removedOutbound, removedReceipts);
    }
}
