using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal sealed record ExecutionDocumentTimeline(DateOnly Date, string Description);

// Only actual document or step-selection changes become command-owned facts.
internal static class ExecutionStepActivity
{
    internal static async Task<bool> Document(FylkrenDbContext db, ExecutionRun run, WorkflowStep step,
        Guid personId, string content, IReadOnlyList<ExecutionDocumentTimeline> events, CancellationToken ct)
    {
        var document = await db.ExecutionStepDocuments.SingleOrDefaultAsync(x => x.RunId == run.Id && x.StepId == step.Id, ct);
        var existing = await db.ExecutionTimelineEvents.Where(x => x.RunId == run.Id && x.StepId == step.Id).OrderBy(x => x.SortOrder).ToListAsync(ct);
        var normalized = content.Trim();
        var textChanged = (document?.Content ?? "") != normalized;
        var timelineChanged = !existing.Select(x => new ExecutionDocumentTimeline(x.Date, x.Description))
            .SequenceEqual(events.Select(x => new ExecutionDocumentTimeline(x.Date, x.Description.Trim())));
        if (!textChanged && !timelineChanged) return false;
        var now = DateTimeOffset.UtcNow;
        if (document is null) db.ExecutionStepDocuments.Add(new ExecutionStepDocument(Guid.NewGuid(), run.Id, step.Id, normalized, now));
        else document.Update(normalized, now);
        if (timelineChanged)
        {
            db.ExecutionTimelineEvents.RemoveRange(existing);
            for (var index = 0; index < events.Count; index++)
                db.ExecutionTimelineEvents.Add(new ExecutionTimelineEvent(Guid.NewGuid(), run.Id, step.Id, events[index].Date, events[index].Description, index));
        }
        var number = await db.WorkflowSteps.CountAsync(x => x.DefinitionId == step.DefinitionId && x.SortOrder < step.SortOrder, ct) + 1;
        Record(db, run, step, number, personId, "execution.step-documented", "documentation", now);
        return true;
    }

    internal static bool Select(FylkrenDbContext db, ExecutionRun run, WorkflowStep step, int index, Guid personId)
    {
        if (run.CurrentStep == index) return false;
        var now = DateTimeOffset.UtcNow;
        run.Advance(index, now);
        Record(db, run, step, index + 1, personId, "execution.step-changed", "currentStep", now);
        return true;
    }

    private static void Record(FylkrenDbContext db, ExecutionRun run, WorkflowStep step, int number,
        Guid personId, string action, string changedFields, DateTimeOffset now)
    {
        // Snapshot workflow labels, never document or timeline content.
        var name = new string(step.Name.Where(x => !char.IsControl(x)).Take(200).ToArray());
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, action, "execution-run", run.Id, now),
            "execution.updated", metadataJson: JsonSerializer.Serialize(new { changedFields, stepNumber = number, stepName = name }));
    }
}
