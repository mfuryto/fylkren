namespace Fylkren.Api.Platform;

public sealed class ApiIdempotencyRecord
{
    private ApiIdempotencyRecord() { }
    public ApiIdempotencyRecord(Guid id, Guid machineIdentityId, string key, string requestHash, Guid resourceId, DateTimeOffset createdAt)
    { Id = id; MachineIdentityId = machineIdentityId; Key = key; RequestHash = requestHash; ResourceId = resourceId; CreatedAt = createdAt; }
    public Guid Id { get; private set; }
    public Guid MachineIdentityId { get; private set; }
    public string Key { get; private set; } = "";
    public string RequestHash { get; private set; } = "";
    public Guid ResourceId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public ApiMachineIdentity MachineIdentity { get; private set; } = null!;
}
