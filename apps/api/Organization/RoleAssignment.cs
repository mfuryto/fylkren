using Fylkren.Api.Identity;

namespace Fylkren.Api.Organization;

public sealed class RoleAssignment
{
    private RoleAssignment() { }
    public RoleAssignment(Guid id, Guid roleId, Guid personId, DateTimeOffset validFrom, DateTimeOffset? validTo, DateTimeOffset createdAt, bool canLeadParentLevel = false)
    {
        Id = id; RoleId = roleId; PersonId = personId; ValidFrom = validFrom; ValidTo = validTo; CanLeadParentLevel = canLeadParentLevel; IsActive = true; CreatedAt = createdAt;
    }
    public Guid Id { get; private set; }
    public Guid RoleId { get; private set; }
    public Guid PersonId { get; private set; }
    public DateTimeOffset ValidFrom { get; private set; }
    public DateTimeOffset? ValidTo { get; private set; }
    public bool IsActive { get; private set; }
    public bool CanLeadParentLevel { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public OrganizationRole Role { get; private set; } = null!;
    public Person Person { get; private set; } = null!;
    public void Deactivate() => IsActive = false;
    public void SetParentLevelLeadership(bool enabled) => CanLeadParentLevel = enabled;
}
