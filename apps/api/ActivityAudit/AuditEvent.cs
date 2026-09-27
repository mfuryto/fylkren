namespace Fylkren.Api.ActivityAudit;

public sealed class AuditEvent
{
    private AuditEvent() { }

    public AuditEvent(Guid id, Guid? siteId, Guid actorPersonId, string eventType, string entityType, Guid entityId, DateTimeOffset occurredAt)
    {
        if (actorPersonId == Guid.Empty) throw new ArgumentException("A local audit actor is required.", nameof(actorPersonId));
        Id = id;
        SiteId = siteId;
        ActorPersonId = actorPersonId;
        EventType = eventType;
        EntityType = entityType;
        EntityId = entityId;
        OccurredAt = occurredAt;
    }

    public static AuditEvent FromFederatedPeer(Guid id, Guid siteId, Guid actorInstanceId,
        Guid actorSiteId, string actorSiteName, string eventType, string entityType,
        Guid entityId, DateTimeOffset occurredAt)
    {
        if (siteId == Guid.Empty || actorInstanceId == Guid.Empty || actorSiteId == Guid.Empty ||
            string.IsNullOrWhiteSpace(actorSiteName) || actorSiteName.Length > 200)
            throw new ArgumentException("A federated audit actor requires an instance and site snapshot.");
        return new AuditEvent
        {
            Id = id, SiteId = siteId, ActorInstanceId = actorInstanceId,
            ActorSiteId = actorSiteId, ActorSiteName = actorSiteName.Trim(),
            EventType = eventType, EntityType = entityType, EntityId = entityId,
            OccurredAt = occurredAt
        };
    }

    public static AuditEvent FromFederatedInstance(Guid id, Guid actorInstanceId,
        string eventType, string entityType, Guid entityId, DateTimeOffset occurredAt)
    {
        if (actorInstanceId == Guid.Empty)
            throw new ArgumentException("A federated instance audit actor is required.", nameof(actorInstanceId));
        return new AuditEvent
        {
            Id = id, ActorInstanceId = actorInstanceId, EventType = eventType,
            EntityType = entityType, EntityId = entityId, OccurredAt = occurredAt
        };
    }

    public static AuditEvent FromSystem(Guid id, string actorSystem, string eventType,
        string entityType, Guid entityId, DateTimeOffset occurredAt)
    {
        if (string.IsNullOrWhiteSpace(actorSystem) || actorSystem.Length > 100)
            throw new ArgumentException("A system audit actor is required.", nameof(actorSystem));
        return new AuditEvent
        {
            Id = id, ActorSystem = actorSystem.Trim(), EventType = eventType,
            EntityType = entityType, EntityId = entityId, OccurredAt = occurredAt
        };
    }

    public Guid Id { get; private set; }
    public Guid? SiteId { get; private set; }
    public Guid? ActorPersonId { get; private set; }
    public Guid? ActorInstanceId { get; private set; }
    public Guid? ActorSiteId { get; private set; }
    public string? ActorSiteName { get; private set; }
    public string? ActorSystem { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public string EntityType { get; private set; } = string.Empty;
    public Guid EntityId { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
    public bool ActorWasPlatformManager { get; private set; }

    public void SnapshotActorRole(bool isPlatformManager) => ActorWasPlatformManager = isPlatformManager;
}
