namespace Fylkren.Api.Platform;

public sealed class ApiReportGrant
{
    private ApiReportGrant() { }
    public ApiReportGrant(Guid id, Guid machineIdentityId, Guid siteId, Guid? organizationUnitId, bool includeClassified, DateTimeOffset createdAt) { Id = id; MachineIdentityId = machineIdentityId; SiteId = siteId; OrganizationUnitId = organizationUnitId; IncludeClassified = includeClassified; CreatedAt = createdAt; }
    public Guid Id { get; private set; }
    public Guid MachineIdentityId { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? OrganizationUnitId { get; private set; }
    public bool IncludeClassified { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public ApiMachineIdentity MachineIdentity { get; private set; } = null!;
    public void Update(bool includeClassified) => IncludeClassified = includeClassified;
}
