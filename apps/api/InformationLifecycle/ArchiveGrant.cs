namespace Fylkren.Api.InformationLifecycle;

public sealed class ArchiveGrant
{
    private ArchiveGrant() { }
    public ArchiveGrant(Guid id, Guid siteId, Guid personId, bool canExport, DateTimeOffset now)
    { Id = id; SiteId = siteId; PersonId = personId; CanExport = canExport; CreatedAt = now; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid PersonId { get; private set; }
    public bool CanExport { get; private set; }
    public bool IsActive { get; private set; } = true;
    public long Version { get; private set; } = 1;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public void Revoke(long version, DateTimeOffset now)
    { if (Version != version || !IsActive) throw new InvalidOperationException("Archive grant has changed."); IsActive = false; RevokedAt = now; Version++; }
}
