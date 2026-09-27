namespace Fylkren.Api.WorkManagement;

public sealed class WorkItemStateHistory
{
    private WorkItemStateHistory() { }
    public Guid Id { get; private set; }
    public Guid WorkItemId { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid? AssignedUnitId { get; private set; }
    public string Status { get; private set; } = string.Empty;
    public DateTimeOffset OccurredAt { get; private set; }
}
