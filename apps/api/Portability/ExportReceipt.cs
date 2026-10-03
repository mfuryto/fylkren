namespace Fylkren.Api.Portability;

// A successful snapshot package and its explicit customer-custody acknowledgement.
// Neither fact authorizes irreversible disposition.
public sealed class ExportReceipt
{
    private ExportReceipt() { }
    public ExportReceipt(Guid id, Guid siteId, Guid actorId, DateTimeOffset at, string boundary, string digest, long bytes, long rootLifecycleVersion)
    {
        if (id == Guid.Empty || siteId == Guid.Empty || actorId == Guid.Empty || rootLifecycleVersion < 0 || bytes <= 0 || digest.Length != 64 || !digest.All(Uri.IsHexDigit) || boundary.Length is < 1 or > 1000)
            throw new ArgumentException("A complete successful snapshot receipt is required.");
        Id = id; SiteId = siteId; CreatedByPersonId = actorId; CreatedAt = at; SnapshotBoundary = boundary; PackageSha256 = digest.ToLowerInvariant(); PackageBytes = bytes; RootLifecycleVersion = rootLifecycleVersion;
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid CreatedByPersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public string SnapshotBoundary { get; private set; } = "";
    public string PackageSha256 { get; private set; } = "";
    public long PackageBytes { get; private set; }
    public long RootLifecycleVersion { get; private set; }
    public long Version { get; private set; } = 1;
    public DateTimeOffset? AcknowledgedAt { get; private set; }
    public Guid? AcknowledgedByPersonId { get; private set; }
    public string? AcknowledgementReason { get; private set; }
    public void Acknowledge(long version, Guid actor, string digest, string reason, DateTimeOffset now)
    {
        if (version != Version || AcknowledgedAt is not null || !string.Equals(PackageSha256, digest, StringComparison.OrdinalIgnoreCase) || actor == Guid.Empty ||
            string.IsNullOrWhiteSpace(reason) || reason.Length > 1000 || reason.Any(char.IsControl))
            throw new InvalidOperationException("A current receipt, matching package digest and bounded custody reason are required.");
        AcknowledgedAt = now; AcknowledgedByPersonId = actor; AcknowledgementReason = reason.Trim(); Version++;
    }
}
