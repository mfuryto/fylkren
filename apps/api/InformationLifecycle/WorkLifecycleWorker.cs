using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

// Reconciles existing reversible lifecycle records after committed delivery/hold
// changes. No extra event store, transport broker or customer-retention scheduler.
internal sealed class WorkLifecycleWorker(IServiceScopeFactory scopes, ILogger<WorkLifecycleWorker> logger) : BackgroundService
{
    private Guid? after;
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                var ids = await db.WorkItems.AsNoTracking().Where(w => (w.Status == "completed" || w.Status == "rejected" || w.Status == "cancelled" || w.Status == "reassigned") &&
                    (after == null || w.Id.CompareTo(after.Value) > 0) && !db.InformationLifecycles.Any(l => l.ResourceType == "work_item" && l.ResourceId == w.Id && (l.Stage == "archived" || l.AutomationPaused)))
                    .OrderBy(w => w.Id).Select(w => w.Id).Take(100).ToArrayAsync(ct);
                if (ids.Length == 0) after = null;
                foreach (var id in ids)
                {
                    await Reconcile(id, db, ct); db.ChangeTracker.Clear(); after = id;
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { return; }
            catch (Exception e) { logger.LogWarning(e, "Automatic work lifecycle reconciliation failed; it will retry."); }
            await Task.Delay(TimeSpan.FromSeconds(5), ct);
        }
    }
    internal static async Task Reconcile(Guid id, FylkrenDbContext db, CancellationToken ct)
    {
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Sites.FromSqlInterpolated($"SELECT s.* FROM sites s JOIN work_items w ON w.site_id=s.id WHERE w.id={id} FOR SHARE OF s").AsNoTracking().ToListAsync(ct);
        await db.Database.SqlQuery<Guid>($$"""
            WITH RECURSIVE chain AS (SELECT id,parent_work_item_id,site_id FROM work_items WHERE id={{id}}
             UNION SELECT w.id,w.parent_work_item_id,w.site_id FROM work_items w JOIN chain c ON w.id=c.parent_work_item_id AND w.site_id=c.site_id)
            SELECT w.id AS "Value" FROM work_items w JOIN chain c ON c.id=w.id ORDER BY w.id FOR UPDATE OF w
            """).ToListAsync(ct);
        var work = await db.WorkItems.SingleOrDefaultAsync(w => w.Id == id, ct);
        if (work is not null && await WorkLifecycleAutomation.Advance(work, db, true, ct)) await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);
    }
}
