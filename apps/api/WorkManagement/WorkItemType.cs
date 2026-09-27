using Fylkren.Api.Organization;

namespace Fylkren.Api.WorkManagement;

public sealed class WorkItemType
{
    private WorkItemType() { }
    public WorkItemType(Guid id, Guid siteId, string name, DateTimeOffset createdAt, bool isSystemManaged = false) { Id = id; SiteId = siteId; Update(name); IsActive = true; IsSystemManaged = isSystemManaged; CreatedAt = createdAt; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public string Name { get; private set; } = "";
    public string NormalizedName { get; private set; } = "";
    public bool IsActive { get; private set; }
    public bool IsSystemManaged { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public ICollection<WorkItem> WorkItems { get; } = [];
    public void Update(string name) { Name = name.Trim(); NormalizedName = Name.ToUpperInvariant(); }
    public void Deactivate() => IsActive = false;
    public void Activate() => IsActive = true;
}
