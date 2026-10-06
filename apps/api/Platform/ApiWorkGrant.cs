namespace Fylkren.Api.Platform;

public sealed class ApiWorkGrant
{
    private ApiWorkGrant() { }

    public ApiWorkGrant(Guid id, Guid machineIdentityId, Guid siteId,
        Guid? organizationUnitId, DateTimeOffset createdAt)
    {
        Id = id;
        MachineIdentityId = machineIdentityId;
        SiteId = siteId;
        OrganizationUnitId = organizationUnitId;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid MachineIdentityId { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? OrganizationUnitId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public ApiMachineIdentity MachineIdentity { get; private set; } = null!;
}
