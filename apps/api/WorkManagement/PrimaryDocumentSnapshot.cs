using Fylkren.Api.Identity;
using Fylkren.Api.Organization;

namespace Fylkren.Api.WorkManagement;

public sealed class PrimaryDocumentSnapshot
{
    private PrimaryDocumentSnapshot() { }
    internal PrimaryDocumentSnapshot(Guid id, Guid siteId, Guid workItemId, int version, string name,
        string mediaType, string sha256, string? sourceUrl, string extractedText, string structuredContent,
        bool availableToAi, Guid createdByPersonId, DateTimeOffset createdAt)
    {
        Id = id; SiteId = siteId; WorkItemId = workItemId; Version = version; Name = name;
        MediaType = mediaType; Sha256 = sha256; SourceUrl = sourceUrl; ExtractedText = extractedText;
        StructuredContent = structuredContent; AvailableToAi = availableToAi;
        CreatedByPersonId = createdByPersonId; CreatedAt = createdAt;
    }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid WorkItemId { get; private set; }
    public int Version { get; private set; }
    public string Name { get; private set; } = "";
    public string MediaType { get; private set; } = "";
    public string Sha256 { get; private set; } = "";
    public string? SourceUrl { get; private set; }
    public string ExtractedText { get; private set; } = "";
    public string StructuredContent { get; private set; } = "";
    public bool AvailableToAi { get; private set; }
    public Guid CreatedByPersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public WorkItem WorkItem { get; private set; } = null!;
    public Site Site { get; private set; } = null!;
    public Person CreatedByPerson { get; private set; } = null!;
}
