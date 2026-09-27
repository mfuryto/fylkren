namespace Fylkren.Api.Federation;

// A local administrative permission for one pair of top-level sites.
// Both installations must grant their respective direction before delivery.
internal sealed class FederationSiteGrant
{
    private FederationSiteGrant() { }

    internal FederationSiteGrant(Guid id, Guid peerInstanceId, Guid localSiteId, Guid remoteSiteId,
        string direction, DateTimeOffset at)
    {
        if (id == Guid.Empty || peerInstanceId == Guid.Empty || localSiteId == Guid.Empty || remoteSiteId == Guid.Empty ||
            direction is not ("inbound" or "outbound"))
            throw new ArgumentException("A site grant needs two site addresses and a direction.");
        Id = id;
        PeerInstanceId = peerInstanceId;
        LocalSiteId = localSiteId;
        RemoteSiteId = remoteSiteId;
        Direction = direction;
        IsActive = true;
        Revision = 1;
        CreatedAt = at;
        UpdatedAt = at;
    }

    public Guid Id { get; private set; }
    public Guid PeerInstanceId { get; private set; }
    public Guid LocalSiteId { get; private set; }
    public Guid RemoteSiteId { get; private set; }
    public string Direction { get; private set; } = string.Empty;
    public bool IsActive { get; private set; }
    public long Revision { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset UpdatedAt { get; private set; }

    internal bool SetActive(bool active, DateTimeOffset at)
    {
        if (IsActive == active) return false;
        IsActive = active;
        Revision++;
        UpdatedAt = at;
        return true;
    }
}
