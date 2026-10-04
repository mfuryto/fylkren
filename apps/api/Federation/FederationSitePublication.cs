namespace Fylkren.Api.Federation;

// Minimal permission to expose a locally owned site's identity to one peer.
// It does not authorize sending work or disclose internal organization units.
internal sealed class FederationSitePublication
{
    private FederationSitePublication() { }

    internal FederationSitePublication(Guid peerInstanceId, Guid localSiteId, DateTimeOffset createdAt)
    {
        if (peerInstanceId == Guid.Empty || localSiteId == Guid.Empty)
            throw new ArgumentException("Peer and local site are required.");
        PeerInstanceId = peerInstanceId;
        LocalSiteId = localSiteId;
        CreatedAt = createdAt;
        UpdatedAt = createdAt;
        IsActive = true;
        Revision = 1;
    }

    public Guid PeerInstanceId { get; private set; }
    public Guid LocalSiteId { get; private set; }
    public bool IsActive { get; private set; }
    public long Revision { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    internal void SetActive(bool active, DateTimeOffset at)
    {
        if (IsActive == active) return;
        var nextRevision = NumericBounds.NextVersion(Revision);
        IsActive = active;
        Revision = nextRevision;
        UpdatedAt = at;
    }

    internal void Refresh(DateTimeOffset at)
    {
        Revision = NumericBounds.NextVersion(Revision);
        UpdatedAt = at;
    }
}
