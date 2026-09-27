namespace Fylkren.Api.Organization;

public sealed class OrganizationUnit
{
    private OrganizationUnit() { }

    public OrganizationUnit(Guid id, Guid siteId, Guid? parentId, string name, bool isTemporary, DateTimeOffset createdAt, bool isSiteRoot = false, int sortOrder = 0, bool worksAtParentLevel = false, bool isSiteLeadership = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Id = id;
        SiteId = siteId;
        ParentId = parentId;
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        IsTemporary = isTemporary;
        IsSiteRoot = isSiteRoot;
        WorksAtParentLevel = worksAtParentLevel;
        IsSiteLeadership = isSiteLeadership;
        SortOrder = sortOrder;
        IsActive = true;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? ParentId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public bool IsTemporary { get; private set; }
    public bool IsSiteRoot { get; private set; }
    public bool WorksAtParentLevel { get; private set; }
    public bool IsSiteLeadership { get; private set; }
    public bool IsActive { get; private set; }
    public int SortOrder { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Site Site { get; private set; } = null!;
    public OrganizationUnit? Parent { get; private set; }
    public ICollection<OrganizationUnit> Children { get; } = [];
    public ICollection<OrganizationRole> Roles { get; } = [];
    public ICollection<OrganizationUnitMembership> Memberships { get; } = [];
    public ICollection<Site> AttachedSites { get; } = [];

    public void Update(Guid? parentId, string name, bool isTemporary, bool isActive, bool worksAtParentLevel, int? sortOrder = null, bool isSiteLeadership = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        ParentId = parentId;
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        IsTemporary = isTemporary;
        IsActive = isActive;
        WorksAtParentLevel = worksAtParentLevel;
        IsSiteLeadership = isSiteLeadership;
        if (sortOrder is { } order) SortOrder = order;
    }

    public void Reorder(int sortOrder) => SortOrder = sortOrder;
}
