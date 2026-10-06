namespace Fylkren.Api.DomainEvents;

public sealed class DomainEvent
{
    private DomainEvent() { }
    public DomainEvent(Guid id, string eventType, int schemaVersion, DateTimeOffset occurredAt, Guid siteId, Guid? actorPersonId, string resourceType, Guid resourceId, string payloadJson)
    {
        Id = id; EventType = eventType; SchemaVersion = schemaVersion; OccurredAt = occurredAt; SiteId = siteId;
        ActorPersonId = actorPersonId; ResourceType = resourceType; ResourceId = resourceId; PayloadJson = payloadJson;
    }
    public static DomainEvent Create(Guid id, string activityType, Guid ownerSiteId, string resourceType, Guid resourceId,
        Guid? contextWorkItemId, DomainEventContext context, string metadataJson, DateTimeOffset occurredAt,
        DateTimeOffset recordedAt, string effectKey, string? legacyWebhookType = null, string legacyPayloadJson = "{}")
    {
        context.Validate();
        if (id == Guid.Empty || ownerSiteId == Guid.Empty || resourceId == Guid.Empty ||
            !ActivityEventCatalog.Resources.Contains(resourceType) || effectKey.Length is < 1 or > 100 ||
            resourceType.Any(char.IsControl) || effectKey.Any(char.IsControl) ||
            legacyWebhookType is not null && !DomainEventTypes.ExternallySupported.Contains(legacyWebhookType))
            throw new ArgumentException("A valid owned resource and event effect are required.");
        var value = new DomainEvent(id, legacyWebhookType ?? activityType, 1, occurredAt, ownerSiteId,
            context.ActorPersonId, resourceType, resourceId, legacyPayloadJson)
        {
            ActivityType = activityType, ActivityMetadataJson = ActivityEventCatalog.ValidateMetadata(activityType, metadataJson),
            Source = context.Source, ActorKind = context.ActorKind, RecordedAt = recordedAt,
            OriginInstanceId = context.OriginInstanceId, OriginSiteId = context.OriginSiteId,
            OperationId = context.OperationId, EffectKey = effectKey, ActorMachineId = context.ActorMachineId,
            ActorSystem = context.ActorSystem, ActorInstanceId = context.ActorInstanceId, ActorSiteId = context.ActorSiteId,
            ContextWorkItemId = contextWorkItemId, CorrelationId = context.CorrelationId,
            CausationEventId = context.CausationEventId, RequestId = context.RequestId, SourceMessageId = context.SourceMessageId
        };
        return value;
    }
    public string? ActivityType { get; private set; }
    public string ActivityMetadataJson { get; private set; } = "{}";
    public string Source { get; private set; } = "legacy";
    public string ActorKind { get; private set; } = "legacy-unknown";
    public DateTimeOffset? RecordedAt { get; private set; }
    public Guid? OriginInstanceId { get; private set; }
    public Guid? OriginSiteId { get; private set; }
    public Guid? OperationId { get; private set; }
    public string? EffectKey { get; private set; }
    public Guid? ActorMachineId { get; private set; }
    public string? ActorSystem { get; private set; }
    public Guid? ActorInstanceId { get; private set; }
    public Guid? ActorSiteId { get; private set; }
    public Guid? ContextWorkItemId { get; private set; }
    public Guid? CorrelationId { get; private set; }
    public Guid? CausationEventId { get; private set; }
    public string? RequestId { get; private set; }
    public Guid? SourceMessageId { get; private set; }
    public Guid Id { get; private set; }
    public string EventType { get; private set; } = string.Empty;
    public int SchemaVersion { get; private set; }
    public DateTimeOffset OccurredAt { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? ActorPersonId { get; private set; }
    public string ResourceType { get; private set; } = string.Empty;
    public Guid ResourceId { get; private set; }
    public string PayloadJson { get; private set; } = "{}";
    public DateTimeOffset? WebhooksProjectedAt { get; private set; }
    public void MarkWebhooksProjected(DateTimeOffset now) => WebhooksProjectedAt = now;
}

public static class DomainEventTypes
{
    public static readonly string[] ExternallySupported = ["task.created", "task.completed", "assignment.created",
        "assignment.accepted", "assignment.updated", "assignment.reopened", "comment.created",
        "plan.approved", "execution.started", "decision.recorded"];
}
