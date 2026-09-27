namespace Fylkren.Api.Federation;

// One deployment identity is shared by all API nodes using the same database.
internal sealed class InstanceIdentity
{
    private InstanceIdentity() { }

    public int Key { get; private set; }
    public Guid InstanceId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}

internal readonly record struct FederatedSiteAddress(Guid InstanceId, Guid SiteId)
{
    public bool IsValid => InstanceId != Guid.Empty && SiteId != Guid.Empty;
}

internal readonly record struct FederatedResourceAddress(Guid InstanceId, Guid SiteId, Guid ResourceId)
{
    public bool IsValid => InstanceId != Guid.Empty && SiteId != Guid.Empty && ResourceId != Guid.Empty;
    public FederatedSiteAddress Site => new(InstanceId, SiteId);
}
