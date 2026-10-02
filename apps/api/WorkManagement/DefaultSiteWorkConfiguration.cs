using Fylkren.Api.Persistence;

namespace Fylkren.Api.WorkManagement;

internal static class DefaultSiteWorkConfiguration
{
    public static void Add(FylkrenDbContext database, Guid siteId, string siteName, DateTimeOffset createdAt)
    {
        database.SiteReferenceSettings.Add(new SiteReferenceSettings(siteId,
            ReferenceCodePolicy.DefaultSitePrefix(siteName, siteId), createdAt, null));
        database.WorkItemTypes.Add(new WorkItemType(Guid.NewGuid(), siteId, "Request", "REQ", createdAt, true));

        var planning = new WorkflowDefinition(Guid.NewGuid(), siteId, null, "Standard", "planning", false);
        database.WorkflowDefinitions.Add(planning);
        database.WorkflowSteps.AddRange(
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Analysis", 0, false, hasTimeline: true),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Task", 1, false),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Intent", 2, false),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Plan", 3, false, allowsTaskAllocation: true));

        var execution = new WorkflowDefinition(Guid.NewGuid(), siteId, null, "Standard", "execution", false);
        database.WorkflowDefinitions.Add(execution);
        database.WorkflowSteps.AddRange(
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Preparation", 0, false),
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Execution", 1, false),
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Closure and follow-up", 2, false));
    }
}
