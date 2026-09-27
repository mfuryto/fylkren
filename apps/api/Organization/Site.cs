namespace Fylkren.Api.Organization;

public sealed class Site
{
    private Site() { }

    public Site(Guid id, string name, DateTimeOffset createdAt)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Id = id;
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        CreatedAt = createdAt;
        IsActive = true;
        OverviewDesign = "classic";
        Version = 1;
    }

    public Guid Id { get; private set; }
    public Guid? ParentOrganizationUnitId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public string? FinalReportTemplate { get; private set; }
    public string OverviewDesign { get; private set; } = "classic";
    public long Version { get; private set; }
    public ICollection<OrganizationUnit> OrganizationUnits { get; } = [];
    public ICollection<OrganizationUnitMembership> OrganizationUnitMemberships { get; } = [];
    public ICollection<SiteManagerAssignment> ManagerAssignments { get; } = [];
    public ICollection<SiteMembership> Memberships { get; } = [];
    public OrganizationUnit? ParentOrganizationUnit { get; private set; }

    public void Update(string name, Guid? parentOrganizationUnitId, bool isActive)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        ParentOrganizationUnitId = parentOrganizationUnitId;
        IsActive = isActive;
        Version++;
    }

    public void UpdateFinalReportTemplate(string? content) => FinalReportTemplate = string.IsNullOrWhiteSpace(content) ? null : content.Trim();
    public void UpdateOverviewDesign(string design) { OverviewDesign = design; Version++; }
}
