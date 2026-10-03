using System.Text.Json;
using Fylkren.Api.Persistence;
using Fylkren.Api.ActivityAudit;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.DomainEvents;

internal static class DomainEventRecorder
{
    internal static void StoreActivity(FylkrenDbContext db, DomainEvent value, AuditEvent? audit, bool notificationsSkipped, bool webhooksSkipped)
    {
        db.DomainEvents.Add(value);
        if (audit is not null)
        {
            if (db.Entry(audit).State == EntityState.Detached) db.AuditEvents.Add(audit);
            audit.Correlate(value.Id, db.ActivityOperationId);
        }
        foreach (var (consumer, skipped) in new[] { ("notifications", notificationsSkipped), ("webhooks", webhooksSkipped) })
        {
            var projection = new EventProjection(consumer, value.Id, DateTimeOffset.UtcNow);
            if (skipped) { var owner = Guid.NewGuid(); projection.Claim(owner, DateTimeOffset.UtcNow); projection.Complete(owner, DateTimeOffset.UtcNow, true); }
            db.EventProjections.Add(projection);
        }
        if (webhooksSkipped) value.MarkWebhooksProjected(DateTimeOffset.UtcNow);
    }
    internal static async Task RecordGovernance(FylkrenDbContext db, AuditEvent audit, string type, Guid siteId, string resourceType, Guid resourceId, object metadata, CancellationToken ct)
    {
        var instance = await db.InstanceIdentities.AsNoTracking().Where(i => i.Key == 1).Select(i => i.InstanceId).SingleAsync(ct);
        var context = new DomainEventContext("local", "person", instance, siteId, db.ActivityOperationId, ActorPersonId: audit.ActorPersonId, CorrelationId: db.ActivityOperationId, RequestId: db.ActivityRequestId);
        var value = DomainEvent.Create(Guid.NewGuid(), type, siteId, resourceType, resourceId, null, context, JsonSerializer.Serialize(metadata), audit.OccurredAt, DateTimeOffset.UtcNow, audit.Id.ToString("N"));
        StoreActivity(db, value, audit, true, true);
    }
    internal static async Task RecordMachineGovernance(FylkrenDbContext db, Fylkren.Api.Platform.ApiMachineAuditEvent audit, CancellationToken ct)
    {
        if (audit.SiteId is not Guid site) throw new InvalidOperationException("Machine activity requires an owned Site.");
        var instance = await db.InstanceIdentities.AsNoTracking().Where(i => i.Key == 1).Select(i => i.InstanceId).SingleAsync(ct);
        var context = new DomainEventContext("local", "machine", instance, site, db.ActivityOperationId, ActorMachineId: audit.MachineIdentityId, CorrelationId: db.ActivityOperationId, RequestId: audit.CorrelationId);
        var type = audit.EventType == "site.moved" ? "site.updated" : audit.EventType;
        var value = DomainEvent.Create(Guid.NewGuid(), type, site, "site", audit.EntityId, null, context, "{}", audit.OccurredAt, DateTimeOffset.UtcNow, audit.Id.ToString("N"));
        StoreActivity(db, value, null, true, true); audit.Correlate(value.Id);
    }
    internal static DomainEvent Record(FylkrenDbContext db, string eventType, Guid siteId, Guid? actorPersonId, string resourceType, Guid resourceId, object? payload, DateTimeOffset now)
    {
        var value = new DomainEvent(Guid.NewGuid(), eventType, 1, now, siteId, actorPersonId, resourceType, resourceId, JsonSerializer.Serialize(payload ?? new { }));
        db.DomainEvents.Add(value);
        return value;
    }
}
