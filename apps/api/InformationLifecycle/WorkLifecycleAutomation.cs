using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal static class WorkLifecycleAutomation
{
    internal static async Task<bool> Advance(WorkItem item, FylkrenDbContext db, bool archive, CancellationToken ct)
    {
        var lifecycle = db.InformationLifecycles.Local.SingleOrDefault(l => l.ResourceType == "work_item" && l.ResourceId == item.Id)
            ?? await db.InformationLifecycles.SingleOrDefaultAsync(l => l.ResourceType == "work_item" && l.ResourceId == item.Id, ct);
        if (lifecycle?.Stage == "archived" || lifecycle?.AutomationPaused == true || !WorkLifecyclePolicy.Terminal(item.Status)) return false;
        if (!await LockDependents(item.Id, db, ct)) return false;
        var ancestors = await db.Database.SqlQuery<Guid>($$"""
            WITH RECURSIVE chain AS (SELECT id,parent_work_item_id,site_id FROM work_items WHERE id={{item.Id}}
             UNION SELECT w.id,w.parent_work_item_id,w.site_id FROM work_items w JOIN chain c ON w.id=c.parent_work_item_id AND w.site_id=c.site_id)
            SELECT id AS "Value" FROM chain
            """).ToArrayAsync(ct);
        if (await db.InformationLifecycles.AnyAsync(l => l.OwnerSiteId == item.SiteId &&
            (l.ResourceType == "site" && (l.IsHeld || l.Stage != "active") || l.ResourceType == "work_item" && ancestors.Contains(l.ResourceId) && l.IsHeld), ct)) return false;
        if ((await WorkLifecyclePolicy.Blockers(item, db, false, ct)).Count > 0) return false;
        if (lifecycle is null) { lifecycle = new(Guid.NewGuid(), item.SiteId, "work_item", item.Id, item.Id, DateTimeOffset.UtcNow); db.InformationLifecycles.Add(lifecycle); }
        var changed = false;
        if (lifecycle.Stage == "active") { await Move(lifecycle, "closed", $"Automatically locked after final {item.Status} status.", db, ct); changed = true; }
        if (archive && lifecycle.Stage == "closed" && (await WorkLifecyclePolicy.Blockers(item, db, true, ct)).Count == 0)
        { await Move(lifecycle, "archived", "Automatically archived after operational follow-up and deliveries were resolved.", db, ct); changed = true; }
        return changed;
    }

    internal static async Task<bool> LockDependents(Guid id, FylkrenDbContext db, CancellationToken ct)
    {
        // Existing writers already serialize the Site/root ancestry. Also lock
        // owned descendants so a child hold/reopen cannot race aggregate disposition.
        // NOWAIT plus a savepoint defers automation under contention without
        // rolling back the valid operational command or creating a deadlock.
        var tx = db.Database.CurrentTransaction ?? throw new InvalidOperationException("Lifecycle requires a transaction.");
        await tx.CreateSavepointAsync("work_lifecycle_graph", ct);
        try
        {
            await db.Database.SqlQuery<Guid>($$"""
                WITH RECURSIVE tree AS (SELECT id,site_id FROM work_items WHERE id={{id}}
                 UNION SELECT w.id,w.site_id FROM work_items w JOIN tree t ON w.parent_work_item_id=t.id AND w.site_id=t.site_id)
                SELECT w.id AS "Value" FROM work_items w JOIN tree t ON t.id=w.id WHERE w.id<>{{id}} ORDER BY w.id FOR UPDATE OF w NOWAIT
                """).ToListAsync(ct);
            await tx.ReleaseSavepointAsync("work_lifecycle_graph", ct); return true;
        }
        catch (Exception e) when (e is Npgsql.PostgresException { SqlState: "55P03" } || e.InnerException is Npgsql.PostgresException { SqlState: "55P03" })
        {
            await tx.RollbackToSavepointAsync("work_lifecycle_graph", ct);
            await tx.ReleaseSavepointAsync("work_lifecycle_graph", ct); return false;
        }
    }

    private static async Task Move(InformationLifecycleRecord record, string stage, string reason, FylkrenDbContext db, CancellationToken ct)
    {
        var now = DateTimeOffset.UtcNow; var previous = record.Stage;
        record.Transition(stage, record.Version, reason, now);
        var type = stage == "closed" ? "information.closed" : "information.archived";
        var audit = AuditEvent.FromSystem(Guid.NewGuid(), "work-lifecycle-automation", type, "work-item", record.ResourceId, now, record.OwnerSiteId).WithReason(reason);
        var instance = await db.InstanceIdentities.AsNoTracking().Where(i => i.Key == 1).Select(i => i.InstanceId).SingleAsync(ct);
        var context = new DomainEventContext("system", "system", instance, record.OwnerSiteId!.Value, db.ActivityOperationId, ActorSystem: "work-lifecycle-automation", CorrelationId: db.ActivityOperationId, RequestId: db.ActivityRequestId);
        var fact = DomainEvent.Create(Guid.NewGuid(), type, record.OwnerSiteId.Value, "work_item", record.ResourceId, record.ResourceId, context,
            System.Text.Json.JsonSerializer.Serialize(new { status = stage, previousStatus = previous }), now, now, audit.Id.ToString("N"));
        DomainEventRecorder.StoreActivity(db, fact, audit, true, true);
    }
}
