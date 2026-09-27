using Fylkren.Api.Organization;

namespace Fylkren.Api.WorkManagement;

public sealed class WorkItemLookup
{
    private WorkItemLookup() { }
    public WorkItemLookup(Guid id, Guid siteId, string kind, string name, DateTimeOffset createdAt) { Id = id; SiteId = siteId; Kind = kind; Update(name); IsActive = true; CreatedAt = createdAt; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public string Kind { get; private set; } = ""; public string Name { get; private set; } = ""; public string NormalizedName { get; private set; } = ""; public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public void Update(string name) { Name = name.Trim(); NormalizedName = Name.ToUpperInvariant(); }
    public void Activate() => IsActive = true; public void Deactivate() => IsActive = false;
}
