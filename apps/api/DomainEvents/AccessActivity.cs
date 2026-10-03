using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;

namespace Fylkren.Api.DomainEvents;

// System effects of a separately audited access decision, using the same command
// transaction/operation correlation. This is not an identity-history event store.
internal static class AccessActivity
{
    internal static void Release(FylkrenDbContext db, WorkflowRun run, DateTimeOffset now, string cause)
    {
        run.Release();
        WorkActivity.Add(db, AuditEvent.FromSystem(Guid.NewGuid(), "access-lifecycle", "workflow.released-on-" + cause, "workflow-run", run.Id, now), "assignment.released", workItemId: run.WorkItemId);
    }
    internal static void Release(FylkrenDbContext db, ExecutionRun run, DateTimeOffset now, string cause)
    {
        run.Release(now);
        WorkActivity.Add(db, AuditEvent.FromSystem(Guid.NewGuid(), "access-lifecycle", "execution.released-on-" + cause, "execution-run", run.Id, now), "assignment.released", workItemId: run.WorkItemId);
    }
}
