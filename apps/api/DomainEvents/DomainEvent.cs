namespace Fylkren.Api.DomainEvents;

public sealed class DomainEvent
{
    private DomainEvent() { }
    public DomainEvent(Guid id, string eventType, int schemaVersion, DateTimeOffset occurredAt, Guid siteId, Guid? actorPersonId, string resourceType, Guid resourceId, string payloadJson)
    {
        Id = id; EventType = eventType; SchemaVersion = schemaVersion; OccurredAt = occurredAt; SiteId = siteId;
        ActorPersonId = actorPersonId; ResourceType = resourceType; ResourceId = resourceId; PayloadJson = payloadJson;
    }
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
    public static readonly string[] ExternallySupported = ["task.created", "task.completed", "assignment.created", "plan.approved", "execution.started", "decision.recorded"];
}
