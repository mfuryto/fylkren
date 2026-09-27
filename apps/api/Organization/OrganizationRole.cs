namespace Fylkren.Api.Organization;

public sealed class OrganizationRole
{
    private OrganizationRole() { }
    public OrganizationRole(Guid id, Guid organizationUnitId, string name, bool isLeader, DateTimeOffset createdAt, bool hasLeaderAccess = false)
    {
        Id = id; OrganizationUnitId = organizationUnitId; Name = name.Trim(); NormalizedName = Name.ToUpperInvariant(); IsLeader = isLeader; HasLeaderAccess = isLeader || hasLeaderAccess; IsActive = true; CreatedAt = createdAt;
    }
    public Guid Id { get; private set; }
    public Guid OrganizationUnitId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string NormalizedName { get; private set; } = string.Empty;
    public bool IsLeader { get; private set; }
    public bool HasLeaderAccess { get; private set; }
    public bool CanPlan { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public OrganizationUnit OrganizationUnit { get; private set; } = null!;
    public ICollection<RoleAssignment> Assignments { get; } = [];

    public void Update(Guid organizationUnitId, string name, bool hasLeaderAccess = false, bool canPlan = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(name);
        OrganizationUnitId = organizationUnitId;
        Name = name.Trim();
        NormalizedName = Name.ToUpperInvariant();
        HasLeaderAccess = IsLeader || hasLeaderAccess;
        CanPlan = canPlan;
    }

    public void Deactivate() => IsActive = false;
}
