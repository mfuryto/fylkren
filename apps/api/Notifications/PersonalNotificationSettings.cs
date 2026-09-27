namespace Fylkren.Api.Notifications;

public sealed class PersonalNotificationSettings
{
    private PersonalNotificationSettings() { }
    public PersonalNotificationSettings(Guid id, Guid siteId, Guid personId) { Id = id; SiteId = siteId; PersonId = personId; }
    public Guid Id { get; private set; }
    public Guid SiteId { get; private set; }
    public Guid PersonId { get; private set; }
    public bool NewWorkItems { get; private set; } = true; public bool WorkItemChanges { get; private set; } = true; public bool DecisionsRequired { get; private set; } = true; public bool ChildWorkCompleted { get; private set; } = true; public bool PlanningCompleted { get; private set; } = true; public bool ExecutionCompleted { get; private set; } = true;
    public void Update(bool newWorkItems, bool workItemChanges, bool decisionsRequired, bool childWorkCompleted, bool planningCompleted, bool executionCompleted) { NewWorkItems = newWorkItems; WorkItemChanges = workItemChanges; DecisionsRequired = decisionsRequired; ChildWorkCompleted = childWorkCompleted; PlanningCompleted = planningCompleted; ExecutionCompleted = executionCompleted; }
}
