namespace Fylkren.Api.WorkManagement;

public sealed class WorkItemComment
{
    private WorkItemComment() { }

    public WorkItemComment(Guid id, Guid siteId, Guid workItemId, Guid authorPersonId, string authorName, string text, DateTimeOffset createdAt)
        : this(id, siteId, workItemId, authorPersonId, null, authorName, text, createdAt) { }

    public static WorkItemComment FromMachine(Guid id, Guid siteId, Guid workItemId,
        Guid authorMachineId, string authorName, string text, DateTimeOffset createdAt) =>
        new(id, siteId, workItemId, null, authorMachineId, authorName, text, createdAt);

    private WorkItemComment(Guid id, Guid siteId, Guid workItemId, Guid? authorPersonId,
        Guid? authorMachineId, string authorName, string text, DateTimeOffset createdAt)
    {
        Id = id;
        SiteId = siteId;
        WorkItemId = workItemId;
        AuthorPersonId = authorPersonId;
        AuthorMachineId = authorMachineId;
        AuthorName = authorName;
        Text = text;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid? AuthorPersonId { get; private set; }
    public Guid? AuthorMachineId { get; private set; }
    public string AuthorName { get; private set; } = "";
    public string Text { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
}
