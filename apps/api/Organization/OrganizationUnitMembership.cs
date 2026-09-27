using Fylkren.Api.Identity;

namespace Fylkren.Api.Organization;

public sealed class OrganizationUnitMembership
{
    private OrganizationUnitMembership() { }

    public OrganizationUnitMembership(Guid id, Guid siteId, Guid organizationUnitId, Guid personId, DateTimeOffset createdAt)
    {
        Id = id;
        SiteId = siteId;
        OrganizationUnitId = organizationUnitId;
        PersonId = personId;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid OrganizationUnitId { get; private set; }
    public Guid PersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public OrganizationUnit OrganizationUnit { get; private set; } = null!;
    public Person Person { get; private set; } = null!;

    public void MoveTo(Guid organizationUnitId) => OrganizationUnitId = organizationUnitId;
}
