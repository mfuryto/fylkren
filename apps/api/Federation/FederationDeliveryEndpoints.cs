using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Federation;

internal static class FederationDeliveryEndpoints
{
    internal static void MapFederationDeliveryEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/federation/peers/{instanceId:guid}/deliveries")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        // Delivery history remains readable after entitlement loss. PayloadJson
        // is deliberately excluded because it can contain task/report content.
        group.MapGet("", async (Guid instanceId, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await db.FederationPeers.AsNoTracking()
                    .AnyAsync(peer => peer.InstanceId == instanceId, ct))
                return Results.NotFound();
            var query = db.FederationOutboundMessages.AsNoTracking()
                .Where(message => message.PeerInstanceId == instanceId);
            var counts = await query.GroupBy(message => message.Status)
                .Select(group => new { Status = group.Key, Count = group.LongCount() })
                .ToDictionaryAsync(row => row.Status, row => row.Count, ct);
            var items = await query.OrderByDescending(message => message.CreatedAt)
                .Take(100)
                .Select(message => new
                {
                    message.MessageId,
                    message.MessageType,
                    message.Status,
                    message.AttemptCount,
                    message.CreatedAt,
                    message.NextAttemptAt,
                    message.DeliveredAt,
                    message.LastErrorCode
                }).ToListAsync(ct);
            long Count(string status) => counts.GetValueOrDefault(status);
            return Results.Ok(new
            {
                pending = Count("pending"), retrying = Count("retrying"),
                delivered = Count("delivered"), failed = Count("failed"), items
            });
        });

        group.MapPost("/{messageId:guid}/retry", async (Guid instanceId, Guid messageId,
            ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
            FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor))
                return Results.Forbid();
            var peer = await db.FederationPeers.AsNoTracking()
                .SingleOrDefaultAsync(value => value.InstanceId == instanceId, ct);
            if (peer is null) return Results.NotFound();
            if (!peer.IsActive || peer.LastProofAt is null || peer.PinnedPublicKeySpki is null)
                return Results.Conflict(new { error = "federation_peer_not_ready" });
            var message = await db.FederationOutboundMessages.AsNoTracking().SingleOrDefaultAsync(value =>
                value.PeerInstanceId == instanceId && value.MessageId == messageId, ct);
            if (message is null) return Results.NotFound();
            if (message.Status != "failed")
                return Results.Conflict(new { error = "federation_delivery_not_failed" });
            var now = DateTimeOffset.UtcNow;
            await using var transaction = await db.Database.BeginTransactionAsync(ct);
            var updated = await db.FederationOutboundMessages.Where(value =>
                    value.PeerInstanceId == instanceId && value.MessageId == messageId &&
                    value.Status == "failed")
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(value => value.Status, "pending")
                    .SetProperty(value => value.AttemptCount, 0)
                    .SetProperty(value => value.NextAttemptAt, now)
                    .SetProperty(value => value.DeliveredAt, (DateTimeOffset?)null)
                    .SetProperty(value => value.LastErrorCode, (string?)null), ct);
            if (updated != 1)
                return Results.Conflict(new { error = "federation_delivery_not_failed" });
            var audit = new AuditEvent(Guid.NewGuid(), null, actor,
                "federation-delivery.retried", "federation-outbound-message", messageId, now);
            audit.SnapshotActorRole(true);
            db.AuditEvents.Add(audit);
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
            return Results.Ok(new { messageId, status = "pending", attemptCount = 0,
                nextAttemptAt = now });
        }).RequireFeature(FeatureCatalog.InstanceFederation);
    }
}
