using Fylkren.Api.Organization;

namespace Fylkren.Api.Platform;

public sealed class ApiMachineAuditEvent
{
    private ApiMachineAuditEvent() { }
    public ApiMachineAuditEvent(Guid id, Guid machineIdentityId, Guid? siteId, string eventType, string entityType, Guid entityId, string correlationId, DateTimeOffset occurredAt)
    { Id = id; MachineIdentityId = machineIdentityId; SiteId = siteId; EventType = eventType; EntityType = entityType; EntityId = entityId; CorrelationId = correlationId; OccurredAt = occurredAt; }
    public Guid? DomainEventId { get; private set; }
    public void Correlate(Guid eventId) => DomainEventId = eventId;
    public Guid Id { get; private set; }
    public Guid MachineIdentityId { get; private set; }
    public Guid? SiteId { get; private set; }
    public string EventType { get; private set; } = "";
    public string EntityType { get; private set; } = "";
    public Guid EntityId { get; private set; }
    public string CorrelationId { get; private set; } = "";
    public DateTimeOffset OccurredAt { get; private set; }
    public ApiMachineIdentity MachineIdentity { get; private set; } = null!;
    public Site? Site { get; private set; }
}
