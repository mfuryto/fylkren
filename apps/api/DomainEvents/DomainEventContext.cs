namespace Fylkren.Api.DomainEvents;

public sealed record DomainEventContext(
    string Source, string ActorKind, Guid OriginInstanceId, Guid OriginSiteId,
    Guid OperationId, Guid? ActorPersonId = null, Guid? ActorMachineId = null,
    string? ActorSystem = null, Guid? ActorInstanceId = null, Guid? ActorSiteId = null,
    Guid? CorrelationId = null, Guid? CausationEventId = null, string? RequestId = null,
    Guid? SourceMessageId = null)
{
    public void Validate()
    {
        if (OriginInstanceId == Guid.Empty || OriginSiteId == Guid.Empty || OperationId == Guid.Empty ||
            RequestId is { Length: > 200 } || RequestId?.Any(char.IsControl) == true)
            throw new ArgumentException("A bounded, server-owned event context is required.");
        var validActor = ActorKind switch
        {
            "person" => Source == "local" && ActorPersonId is { } person && person != Guid.Empty &&
                ActorMachineId is null && ActorSystem is null && ActorInstanceId is null && ActorSiteId is null,
            "machine" => Source == "local" && ActorMachineId is { } machine && machine != Guid.Empty &&
                ActorPersonId is null && ActorSystem is null && ActorInstanceId is null && ActorSiteId is null,
            "system" => Source == "system" && ActorSystem is { Length: > 0 and <= 100 } &&
                !ActorSystem.Any(char.IsControl) && ActorPersonId is null && ActorMachineId is null && ActorInstanceId is null && ActorSiteId is null,
            "federated-site" => Source == "federated" && ActorInstanceId is { } instance && instance != Guid.Empty &&
                ActorSiteId is { } site && site != Guid.Empty && ActorPersonId is null && ActorMachineId is null && ActorSystem is null,
            _ => false
        };
        if (!validActor) throw new ArgumentException("Event actor and source must agree.");
    }
}
