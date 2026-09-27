using Fylkren.Api.Identity;

namespace Fylkren.Api.Approvals;

public sealed class DomainObjectVersion
{
    private DomainObjectVersion() { }
    public DomainObjectVersion(Guid id, Guid siteId, string objectType, Guid objectId, Guid contextWorkItemId, int versionNumber, string title, string contentJson, string contentHash, Guid createdByPersonId, DateTimeOffset createdAt)
    {
        Id = id; SiteId = siteId; ObjectType = objectType; ObjectId = objectId; ContextWorkItemId = contextWorkItemId;
        VersionNumber = versionNumber; Title = title.Trim(); ContentJson = contentJson; ContentHash = contentHash;
        CreatedByPersonId = createdByPersonId; CreatedAt = createdAt; ApprovalStatus = "pending";
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public string ObjectType { get; private set; } = "";
    public Guid ObjectId { get; private set; }
    public Guid ContextWorkItemId { get; private set; }
    public int VersionNumber { get; private set; }
    public string Title { get; private set; } = "";
    public string ContentJson { get; private set; } = "{}";
    public string ContentHash { get; private set; } = "";
    public string ApprovalStatus { get; private set; } = "pending";
    public Guid CreatedByPersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public Person CreatedByPerson { get; private set; } = null!;
    public ICollection<FormalApprovalSignoff> Signoffs { get; } = [];
    public void MarkApproved() => ApprovalStatus = "approved";
}

public sealed class FormalApprovalSignoff
{
    private FormalApprovalSignoff() { }
    public FormalApprovalSignoff(Guid id, Guid versionId, Guid approverPersonId, string approverNameSnapshot, string status, DateTimeOffset signedAt, string? comment = null)
    {
        Id = id; VersionId = versionId; ApproverPersonId = approverPersonId; ApproverNameSnapshot = approverNameSnapshot.Trim();
        Status = status; SignedAt = signedAt; Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim();
    }
    public Guid Id { get; private set; }
    public Guid VersionId { get; private set; }
    public Guid ApproverPersonId { get; private set; }
    public string ApproverNameSnapshot { get; private set; } = "";
    public string Status { get; private set; } = "approved";
    public DateTimeOffset SignedAt { get; private set; }
    public string? Comment { get; private set; }
    public DomainObjectVersion Version { get; private set; } = null!;
    public Person ApproverPerson { get; private set; } = null!;
}
