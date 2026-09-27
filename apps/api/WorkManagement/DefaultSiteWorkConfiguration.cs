using Fylkren.Api.Persistence;

namespace Fylkren.Api.WorkManagement;

internal static class DefaultSiteWorkConfiguration
{
    public static void Add(FylkrenDbContext database, Guid siteId, DateTimeOffset createdAt)
    {
        database.WorkItemTypes.Add(new WorkItemType(Guid.NewGuid(), siteId, "Anmodning", createdAt, true));

        var planning = new WorkflowDefinition(Guid.NewGuid(), siteId, null, "Standard", "planning", false);
        database.WorkflowDefinitions.Add(planning);
        database.WorkflowSteps.AddRange(
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Analyse", 0, false, hasTimeline: true),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Oppdrag", 1, false),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Intensjon", 2, false),
            new WorkflowStep(Guid.NewGuid(), planning.Id, "Plan", 3, false, allowsTaskAllocation: true));

        var execution = new WorkflowDefinition(Guid.NewGuid(), siteId, null, "Standard", "execution", false);
        database.WorkflowDefinitions.Add(execution);
        database.WorkflowSteps.AddRange(
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Forberedelser", 0, false),
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Gjennomføring", 1, false),
            new WorkflowStep(Guid.NewGuid(), execution.Id, "Avslutning og etterarbeid", 2, false));
    }
}
