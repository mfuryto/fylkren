namespace Fylkren.Api.WorkManagement;

public sealed class WorkItemDependency
{
    public const string FinishToStart = "finish_to_start";

    private WorkItemDependency() { }

    public WorkItemDependency(Guid id, Guid siteId, Guid predecessorWorkItemId, Guid dependentWorkItemId, string type, Guid createdByPersonId, DateTimeOffset createdAt)
    {
        Id = id;
        SiteId = siteId;
        PredecessorWorkItemId = predecessorWorkItemId;
        DependentWorkItemId = dependentWorkItemId;
        Type = type;
        CreatedByPersonId = createdByPersonId;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid PredecessorWorkItemId { get; private set; }
    public Guid DependentWorkItemId { get; private set; }
    public string Type { get; private set; } = FinishToStart;
    public Guid CreatedByPersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public WorkItem PredecessorWorkItem { get; private set; } = null!;
    public WorkItem DependentWorkItem { get; private set; } = null!;
}
