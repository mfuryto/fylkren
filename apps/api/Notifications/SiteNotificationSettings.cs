namespace Fylkren.Api.Notifications;

public sealed class SiteNotificationSettings
{
    private SiteNotificationSettings() { }
    public SiteNotificationSettings(Guid id, Guid siteId) { Id = id; SiteId = siteId; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public bool NewWorkItems { get; private set; }
    public bool WorkItemChanges { get; private set; }
    public bool DecisionsRequired { get; private set; }
    public bool ChildWorkCompleted { get; private set; }
    public bool PlanningCompleted { get; private set; }
    public bool ExecutionCompleted { get; private set; }
    public void Update(bool newWorkItems, bool workItemChanges, bool decisionsRequired, bool childWorkCompleted, bool planningCompleted, bool executionCompleted) { NewWorkItems = newWorkItems; WorkItemChanges = workItemChanges; DecisionsRequired = decisionsRequired; ChildWorkCompleted = childWorkCompleted; PlanningCompleted = planningCompleted; ExecutionCompleted = executionCompleted; }
}
