using Fylkren.Api.Persistence;
using Fylkren.Api.Organization;

namespace Fylkren.Api.WorkManagement;

internal static class DefaultSiteWorkConfiguration
{
    internal const string FinalReportTemplate = "# Summary\n\n# Execution\n\n# Conclusion";

    public static void Add(FylkrenDbContext database, Site site, DateTimeOffset createdAt)
    {
        site.UpdateFinalReportTemplate(FinalReportTemplate);
        database.SiteReferenceSettings.Add(new SiteReferenceSettings(site.Id,
            ReferenceCodePolicy.DefaultSitePrefix(site.Name, site.Id), createdAt, null));
        database.WorkItemTypes.Add(new WorkItemType(Guid.NewGuid(), site.Id, "Request", "REQ", createdAt, true));

        var planning = new WorkflowDefinition(Guid.NewGuid(), site.Id, null, "Standard", "planning", false);
        database.WorkflowDefinitions.Add(planning);
        database.WorkflowSteps.AddRange(
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Analysis", 0, false, hasTimeline: true),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Task", 1, false),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Intent", 2, false),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Plan", 3, false, allowsTaskAllocation: true));

        var execution = new WorkflowDefinition(Guid.NewGuid(), site.Id, null, "Standard", "execution", false);
        database.WorkflowDefinitions.Add(execution);
        database.WorkflowSteps.AddRange(
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Preparation", 0, false),
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Execution", 1, false),
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Closure and follow-up", 2, false));
    }
}
