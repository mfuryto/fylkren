using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Notifications;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.DomainEvents;

// Command-owned intent. Never reconstruct activity by scanning security audit records.
internal sealed record WorkActivityIntent(AuditEvent Audit, string Type, string? NotificationKind, Guid? WorkItemId, Guid? SourceMessageId, Guid? CorrelationId, Guid? OriginSiteId, string? MetadataJson);
internal static class WorkActivity
{
    internal static void Add(FylkrenDbContext db, AuditEvent audit, string type, string? notificationKind = null, Guid? workItemId = null, Guid? sourceMessageId = null, Guid? correlationId = null, Guid? originSiteId = null, string? metadataJson = null)
    {
        if (!ActivityEventCatalog.Types.Contains(type)) throw new ArgumentException("Unknown command activity.");
        db.AuditEvents.Add(audit);
        db.PendingWorkActivities.Add(new(audit, type, notificationKind, workItemId, sourceMessageId, correlationId, originSiteId, metadataJson));
    }

    internal static async Task Prepare(FylkrenDbContext db, CancellationToken ct)
    {
        if (db.PendingWorkActivities.Count == 0) return;
        var instance = await db.InstanceIdentities.AsNoTracking().Where(x => x.Key == 1).Select(x => x.InstanceId).SingleAsync(ct);
        foreach (var intent in db.PendingWorkActivities)
        {
            var audit = intent.Audit;
            var rootId = intent.WorkItemId ?? (audit.EntityType switch
            {
                "work-item" => audit.EntityId,
                "workflow-run" => db.ChangeTracker.Entries<Fylkren.Api.WorkManagement.WorkflowRun>().Select(x => x.Entity).FirstOrDefault(x => x.Id == audit.EntityId)?.WorkItemId
                    ?? await db.WorkflowRuns.Where(x => x.Id == audit.EntityId).Select(x => (Guid?)x.WorkItemId).SingleOrDefaultAsync(ct),
                "execution-run" => db.ChangeTracker.Entries<Fylkren.Api.WorkManagement.ExecutionRun>().Select(x => x.Entity).FirstOrDefault(x => x.Id == audit.EntityId)?.WorkItemId
                    ?? await db.ExecutionRuns.Where(x => x.Id == audit.EntityId).Select(x => (Guid?)x.WorkItemId).SingleOrDefaultAsync(ct),
                _ => null
            });
            if (rootId is null) throw new InvalidOperationException("Command activity requires a work context.");
            var item = db.ChangeTracker.Entries<Fylkren.Api.WorkManagement.WorkItem>().Select(x => x.Entity).FirstOrDefault(x => x.Id == rootId)
                ?? await db.WorkItems.SingleAsync(x => x.Id == rootId, ct);
            // A source-site audit about a recipient-owned resource remains audit-only.
            if (audit.SiteId is Guid auditSite && auditSite != item.SiteId) continue;
            var old = db.ChangeTracker.Entries<DomainEvent>().FirstOrDefault(x => x.State == EntityState.Added &&
                x.Entity.ActivityType == null && x.Entity.SiteId == item.SiteId && x.Entity.ResourceId == audit.EntityId);
            var resource = old?.Entity.ResourceType ?? (audit.EntityType == "workflow-run" ? "plan" : audit.EntityType == "execution-run" ? "execution" : intent.Type.StartsWith("report.", StringComparison.Ordinal) ? "report" : "work_item");
            var crossSiteActor = old is not null ? old.Entity.ActorPersonId is null : audit.ActorPersonId is Guid person && !await db.SiteMemberships.AnyAsync(x => x.SiteId == item.SiteId && x.PersonId == person && x.IsActive, ct);
            var context = audit.ActorInstanceId is Guid peer && audit.ActorSiteId is Guid peerSite
                ? new DomainEventContext("federated", "federated-site", peer, peerSite, db.ActivityOperationId, ActorInstanceId: peer, ActorSiteId: peerSite, CorrelationId: db.ActivityOperationId)
                : audit.ActorPersonId is Guid actor && !crossSiteActor
                    ? new DomainEventContext("local", "person", instance, item.SiteId, db.ActivityOperationId, ActorPersonId: actor, CorrelationId: db.ActivityOperationId)
                    : new DomainEventContext("system", "system", instance, item.SiteId, db.ActivityOperationId, ActorSystem: audit.ActorSystem ?? "cross-site-routing", CorrelationId: db.ActivityOperationId);
            var transport = intent.Type == "assignment.dispatch_queued" ? db.ChangeTracker.Entries<Fylkren.Api.Federation.FederationOutboundMessage>()
                .Select(x => x.Entity).FirstOrDefault(x => x.OriginResourceId == item.Id && x.SourceSiteId == item.SiteId) : null;
            context = context with { OriginSiteId = intent.OriginSiteId ?? context.OriginSiteId };
            context = context with { SourceMessageId = intent.SourceMessageId ?? transport?.MessageId, CorrelationId = intent.CorrelationId ?? transport?.CorrelationId ?? db.ActivityOperationId, RequestId = db.ActivityRequestId };
            var activityType = intent.Type == "assignment.started" && await db.DomainEvents.AnyAsync(x => x.ContextWorkItemId == item.Id && x.ActivityType == "assignment.started", ct) ? "assignment.updated" : intent.Type;
            var value = DomainEvent.Create(old?.Entity.Id ?? Guid.NewGuid(), activityType, item.SiteId, resource, audit.EntityId, item.Id, context,
                intent.MetadataJson ?? JsonSerializer.Serialize(new { status = item.Status }), audit.OccurredAt, DateTimeOffset.UtcNow, audit.Id.ToString("N"), old?.Entity.EventType, old?.Entity.PayloadJson ?? "{}");
            if (old is not null) old.State = EntityState.Detached;
            db.DomainEvents.Add(value);
            audit.Correlate(value.Id, db.ActivityOperationId);
            db.EventProjections.Add(new EventProjection("notifications", value.Id, DateTimeOffset.UtcNow));
            var webhookProjection = new EventProjection("webhooks", value.Id, DateTimeOffset.UtcNow);
            var subscriptions = old is null ? [] : await db.WebhookSubscriptions.AsNoTracking().Where(x => x.SiteId == item.SiteId && x.IsActive && x.CreatedAt <= value.OccurredAt).ToListAsync(ct);
            if (!subscriptions.Any(x => x.SelectedEventTypes().Contains(value.EventType)))
            {
                var owner = Guid.NewGuid(); webhookProjection.Claim(owner, DateTimeOffset.UtcNow);
                webhookProjection.Complete(owner, DateTimeOffset.UtcNow, true); value.MarkWebhooksProjected(DateTimeOffset.UtcNow);
            }
            db.EventProjections.Add(webhookProjection);
        }
        foreach (var entry in db.ChangeTracker.Entries<Fylkren.Api.WorkManagement.WorkItem>().Where(x => x.State == EntityState.Added).ToArray())
            db.InformationLifecycles.Add(new InformationLifecycleRecord(Guid.NewGuid(), entry.Entity.SiteId, "work_item", entry.Entity.Id, entry.Entity.Id, DateTimeOffset.UtcNow));
    }

    internal static async Task ProjectNotifications(FylkrenDbContext db, string publicUrl, CancellationToken ct)
    {
        foreach (var intent in db.PendingWorkActivities)
        {
            if (intent.Audit.DomainEventId is not Guid id) continue;
            var projection = db.EventProjections.Local.Single(x => x.Consumer == "notifications" && x.DomainEventId == id);
            var owner = Guid.NewGuid(); var now = DateTimeOffset.UtcNow; projection.Claim(owner, now);
            if (intent.NotificationKind is string kind && intent.Audit.SiteId is Guid site)
            {
                var destination = await NotificationEventProjector.NotificationSite(db, intent.Audit, site, kind, ct);
                if (await NotificationEventProjector.Enabled(db, destination, kind, ct))
                    await NotificationEventProjector.Enqueue(db, intent.Audit, destination, kind, publicUrl, ct);
            }
            projection.Complete(owner, DateTimeOffset.UtcNow, intent.NotificationKind is null);
        }
        db.PendingWorkActivities.Clear();
    }
}
