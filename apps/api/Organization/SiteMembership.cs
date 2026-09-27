using Fylkren.Api.Identity;

namespace Fylkren.Api.Organization;

public sealed class SiteMembership
{
    private SiteMembership() { }
    public SiteMembership(Guid id, Guid siteId, Guid personId, DateTimeOffset createdAt)
    {
        Id = id; SiteId = siteId; PersonId = personId; IsActive = true; CreatedAt = createdAt;
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid PersonId { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public Person Person { get; private set; } = null!;
    public void Activate() => IsActive = true;
    public void Deactivate() => IsActive = false;
}
