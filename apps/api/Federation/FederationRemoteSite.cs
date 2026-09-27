namespace Fylkren.Api.Federation;

// A remote site's metadata snapshot. It is never a locally owned Site.
internal sealed class FederationRemoteSite
{
    private FederationRemoteSite() { }

    internal FederationRemoteSite(Guid instanceId, Guid siteId, string name, long catalogRevision,
        bool isActive, DateTimeOffset updatedAt)
    {
        if (instanceId == Guid.Empty || siteId == Guid.Empty || catalogRevision < 1)
            throw new ArgumentException("A remote site requires stable addresses and a positive catalog revision.");
        ValidateName(name);
        InstanceId = instanceId;
        SiteId = siteId;
        Name = name;
        CatalogRevision = catalogRevision;
        UpdatedAt = updatedAt;
        IsActive = isActive;
    }

    public Guid InstanceId { get; private set; }
    public Guid SiteId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public long CatalogRevision { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public bool IsActive { get; private set; }

    internal bool ApplySnapshot(string name, long revision, bool isActive, DateTimeOffset updatedAt)
    {
        if (revision <= CatalogRevision) return false;
        ValidateName(name);
        Name = name;
        CatalogRevision = revision;
        IsActive = isActive;
        UpdatedAt = updatedAt;
        return true;
    }

    internal bool Suspend(DateTimeOffset at)
    {
        if (!IsActive) return false;
        IsActive = false;
        UpdatedAt = at;
        return true;
    }

    private static void ValidateName(string name)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > 200)
            throw new ArgumentException("Remote site name is invalid.", nameof(name));
    }
}
