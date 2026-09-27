namespace Fylkren.Api.Identity;

using Fylkren.Api.Organization;

public sealed class Person
{
    private Person() { }

    public Person(Guid id, string displayName, DateTimeOffset createdAt, string? email = null)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayName);
        Id = id;
        DisplayName = displayName.Trim();
        SetEmail(email);
        CreatedAt = createdAt;
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public string DisplayName { get; private set; } = string.Empty;
    public string? Email { get; private set; }
    public string? NormalizedEmail { get; private set; }
    public bool IsActive { get; private set; }
    public bool IsDeleted { get; private set; }
    public DateTimeOffset? DeletedAt { get; private set; }
    public byte[]? ProfileImage { get; private set; }
    public string? ProfileImageContentType { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public ICollection<LoginIdentity> LoginIdentities { get; } = [];
    public ICollection<ExternalIdentityLink> ExternalIdentityLinks { get; } = [];
    public ICollection<WebAuthnCredential> WebAuthnCredentials { get; } = [];
    public ICollection<SiteManagerAssignment> SiteManagerAssignments { get; } = [];
    public ICollection<SiteMembership> SiteMemberships { get; } = [];
    public ICollection<OrganizationUnitMembership> OrganizationUnitMemberships { get; } = [];
    public ICollection<RoleAssignment> RoleAssignments { get; } = [];

    public void Update(string displayName, bool isActive)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(displayName);
        DisplayName = displayName.Trim();
        IsActive = isActive;
    }

    public void UpdateWithEmail(string displayName, bool isActive, string email)
    {
        Update(displayName, isActive);
        SetEmail(email);
    }

    private void SetEmail(string? email)
    {
        Email = string.IsNullOrWhiteSpace(email) ? null : email.Trim();
        NormalizedEmail = Email?.ToUpperInvariant();
    }

    public void SetProfileImage(byte[]? image, string? contentType)
    {
        ProfileImage = image;
        ProfileImageContentType = image is null ? null : contentType;
    }

    public void Delete(DateTimeOffset now)
    {
        Email = null;
        NormalizedEmail = null;
        ProfileImage = null;
        ProfileImageContentType = null;
        IsActive = false;
        IsDeleted = true;
        DeletedAt = now;
    }
}
