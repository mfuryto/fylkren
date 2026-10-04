using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Identity;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Learning;
using Fylkren.Api.Notifications;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

internal static class AutomaticLifecycleTests
{
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    internal static async Task Run(FylkrenDbContext db)
    {
        await VerifyUpgrade(db);
        db.ChangeTracker.Clear(); var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), "Synthetic automatic lifecycle", now);
        var unit = new OrganizationUnit(Guid.NewGuid(), site.Id, null, "Synthetic learning level", false, now);
        var author = new Person(Guid.NewGuid(), "Synthetic learning reviewer", now);
        db.Sites.Add(site); db.OrganizationUnits.Add(unit); db.People.Add(author);
        db.SiteReferenceSettings.Add(new(site.Id, "AUTO", now, null)); await db.SaveChangesAsync();
        async Task<WorkItem> Create(string title, Guid? parent = null)
        {
            var work = new WorkItem(Guid.NewGuid(), site.Id, author.Id, title, "Synthetic", null, "normal", null, now, parentWorkItemId: parent);
            db.WorkItems.Add(work);
            WorkActivity.Add(db, AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-test", "work-item.registered", "work-item", work.Id, now), "task.created");
            await db.SaveChangesAsync(); return work;
        }
        var work = await Create("Automatic pending delivery");
        var lesson = new LearningLesson(Guid.NewGuid(), site.Id, work.Id, unit.Id, 1, "improvement", "Original observation", author.Id, author.DisplayName, now);
        db.LearningLessons.Add(lesson); await db.SaveChangesAsync();
        var audit = AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-test", "synthetic.delivery", "work-item", work.Id, now);
        db.AuditEvents.Add(audit);
        var message = new NotificationOutboxMessage(Guid.NewGuid(), audit.Id, site.Id, work.Id, author.Id, "synthetic@example.invalid", "Synthetic", "Synthetic", "Synthetic", "Synthetic", now);
        db.NotificationOutboxMessages.Add(message); await db.SaveChangesAsync();
        work.TransitionWithinLevel("rejected", "Final decision", now);
        await db.SaveChangesAsync();
        var state = await db.InformationLifecycles.SingleAsync(l => l.ResourceId == work.Id);
        Require(state.Stage == "closed", "Final rejection was not locked in the same transaction.");
        var lockedFact = await db.DomainEvents.SingleAsync(e => e.ContextWorkItemId == work.Id && e.ActivityType == "information.closed");
        var lockedAudit = await db.AuditEvents.SingleAsync(a => a.DomainEventId == lockedFact.Id);
        Require(lockedFact.Source == "system" && lockedFact.ActorSystem == "work-lifecycle-automation" && lockedAudit.ActorSystem == "work-lifecycle-automation", "Automatic fact/audit attribution was fabricated.");
        Require(await db.EventProjections.CountAsync(p => p.DomainEventId == lockedFact.Id && p.Status == "skipped") == 2, "Automatic locking duplicated external delivery.");
        Require((await WorkLifecyclePolicy.Blockers(work, db, true, default)).ContainsKey("pending_notifications"), "Pending delivery did not block archive.");
        await WorkLifecycleWorker.Reconcile(work.Id, db, default);
        Require(state.Stage == "closed", "Pending delivery was silently archived.");
        for (var i = 0; i < 5; i++) message.Failed(now, "Synthetic failure"); await db.SaveChangesAsync();
        Require((await WorkLifecyclePolicy.Blockers(work, db, true, default)).ContainsKey("failed_deliveries"), "Failed required delivery did not remain visible.");
        await WorkLifecycleWorker.Reconcile(work.Id, db, default);
        Require(state.Stage == "closed", "Failed delivery was silently archived.");
        message.Sent(now); await db.SaveChangesAsync();
        // Shared projections also have to resolve; only the synthetic task-created webhook consumer is pending.
        foreach (var p in await db.EventProjections.Where(p => p.Status == "pending" && db.DomainEvents.Any(e => e.Id == p.DomainEventId && e.ContextWorkItemId == work.Id)).ToListAsync())
        { var lease = Guid.NewGuid(); p.Claim(lease, now); p.Complete(lease, now); }
        await db.SaveChangesAsync();
        var options = new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(db.Database.GetConnectionString()).Options;
        db.ChangeTracker.Clear();
        await using (var first = new FylkrenDbContext(options))
        await using (var second = new FylkrenDbContext(options))
            await Task.WhenAll(WorkLifecycleWorker.Reconcile(work.Id, first, default), WorkLifecycleWorker.Reconcile(work.Id, second, default));
        state = await db.InformationLifecycles.SingleAsync(l => l.ResourceId == work.Id);
        Require(state.Stage == "archived" && await db.DomainEvents.CountAsync(e => e.ContextWorkItemId == work.Id && e.ActivityType == "information.archived") == 1, "Concurrent archive duplicated history.");
        lesson = await db.LearningLessons.SingleAsync(l => l.Id == lesson.Id);
        lesson.Review("in_progress", "high", "Resolve the lesson", "Learning continues", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1)), author.Id, author.DisplayName, now);
        db.LearningEntries.Add(new LearningEntry(Guid.NewGuid(), site.Id, lesson.Id, author.Id, author.DisplayName, "review", "Learning continues", now));
        await db.SaveChangesAsync();
        Require(lesson.Text == "Original observation" && lesson.Status == "in_progress", "Archive blocked independent learning treatment.");
        await Forbidden(db, $"UPDATE learning_lessons SET text='Forbidden rewrite' WHERE id='{lesson.Id}'", "work_lifecycle_guard");
        await Forbidden(db, $"DELETE FROM learning_lessons WHERE id='{lesson.Id}'", "work_lifecycle_guard");
        await Forbidden(db, $"UPDATE work_items SET title='Forbidden rewrite' WHERE id='{work.Id}'", "work_lifecycle_guard");
        await Forbidden(db, $"DELETE FROM work_items WHERE id='{work.Id}'", "work_lifecycle_guard");
        var siteState = new InformationLifecycleRecord(Guid.NewGuid(), site.Id, "site", site.Id, null, now);
        siteState.Transition("closed", 1, "Entire Site retired", now); db.InformationLifecycles.Add(siteState); await db.SaveChangesAsync();
        await Forbidden(db, $"UPDATE learning_lessons SET treatment_note='Site is retired' WHERE id='{lesson.Id}'", "site_lifecycle_guard");
        siteState.Transition("active", siteState.Version, "Restore Site", now); await db.SaveChangesAsync();
        state.Transition("closed", state.Version, "Restore", now); state.Transition("active", state.Version, "Edit historic task", now); state.SetAutomationPaused(true); await db.SaveChangesAsync();
        await WorkLifecycleWorker.Reconcile(work.Id, db, default);
        Require(state.Stage == "active" && state.AutomationPaused, "Explicit reopening was immediately undone.");
        state.SetAutomationPaused(false); await db.SaveChangesAsync(); await WorkLifecycleWorker.Reconcile(work.Id, db, default);
        Require(state.Stage == "archived", "Ending the editing pause did not resume automatic lifecycle.");
        var active = await Create("Active parent"); var child = await Create("Archived child", active.Id);
        child.TransitionWithinLevel("rejected", "Final decision", now); await db.SaveChangesAsync();
        foreach (var p in await db.EventProjections.Where(p => p.Status == "pending" && db.DomainEvents.Any(e => e.Id == p.DomainEventId && e.ContextWorkItemId == child.Id)).ToListAsync()) { var lease = Guid.NewGuid(); p.Claim(lease, now); p.Complete(lease, now); }
        await db.SaveChangesAsync(); await WorkLifecycleWorker.Reconcile(child.Id, db, default);
        var archived = await WorkItemQueuePager.Select(db.WorkItems.Where(w => w.SiteId == site.Id), site.Id, null, "archived", "Archived child", "newest", 1, null, db, default);
        Require(archived.ItemIds.Contains(child.Id) && !archived.ItemIds.Contains(active.Id), "Archived child disappeared beneath an active parent.");
        var ordinary = await WorkItemQueuePager.Select(db.WorkItems.Where(w => w.SiteId == site.Id), site.Id, null, "completed", null, "newest", 1, null, db, default);
        Require(!ordinary.ItemIds.Contains(work.Id), "Archived root remained in ordinary completed list.");
        var all = await WorkItemQueuePager.Select(db.WorkItems.Where(w => w.SiteId == site.Id), site.Id, null, "all", null, "newest", 1, null, db, default);
        Require(archived.Summary == all.Summary, "Archive filter changed operational counters.");
        Require(all.ItemIds.Contains(work.Id) && all.ItemIds.Contains(child.Id), "All lost archived history.");
        var held = await Create("Held rejected task"); var heldState = await db.InformationLifecycles.SingleAsync(l => l.ResourceId == held.Id);
        heldState.SetHold(true, heldState.Version, "Preserve evidence", now); await db.SaveChangesAsync();
        held.TransitionWithinLevel("rejected", "Final decision", now); await db.SaveChangesAsync(); await WorkLifecycleWorker.Reconcile(held.Id, db, default);
        Require(heldState.Stage == "active", "Preservation was ignored.");
        heldState.SetHold(false, heldState.Version, "Release evidence hold", now); await db.SaveChangesAsync();
        await WorkLifecycleWorker.Reconcile(held.Id, db, default); Require(heldState.Stage is "closed" or "archived", "Releasing preservation did not allow automatic locking: " + heldState.Stage + " " + System.Text.Json.JsonSerializer.Serialize(await WorkLifecyclePolicy.Blockers(held, db, false, default)));
        var concurrentParent = await Create("Concurrent preservation parent");
        var concurrentChild = await Create("Concurrent preservation child", concurrentParent.Id);
        concurrentChild.TransitionWithinLevel("rejected", "Final child decision", now); await db.SaveChangesAsync();
        await using (var other = new FylkrenDbContext(options))
        await using (var tx = await other.Database.BeginTransactionAsync())
        {
            await other.WorkItems.FromSqlInterpolated($"SELECT *,xmin FROM work_items WHERE id={concurrentChild.Id} FOR UPDATE").ToListAsync();
            var childState = await other.InformationLifecycles.SingleAsync(l => l.ResourceId == concurrentChild.Id);
            childState.SetHold(true, childState.Version, "Concurrent descendant preservation", now); await other.SaveChangesAsync();
            concurrentParent.TransitionWithinLevel("rejected", "Final parent decision", now); await db.SaveChangesAsync();
            Require((await db.InformationLifecycles.SingleAsync(l => l.ResourceId == concurrentParent.Id)).Stage == "active", "Contended descendant preservation was ignored.");
            await tx.CommitAsync();
        }
        await WorkLifecycleWorker.Reconcile(concurrentParent.Id, db, default);
        Require((await db.InformationLifecycles.SingleAsync(l => l.ResourceId == concurrentParent.Id)).Stage == "active", "Committed descendant hold was ignored.");
        var rollback = await Create("Atomic terminal rollback");
        await using (var tx = await db.Database.BeginTransactionAsync()) { rollback.TransitionWithinLevel("rejected", "Rolled back decision", now); await db.SaveChangesAsync(); await tx.RollbackAsync(); }
        db.ChangeTracker.Clear();
        Require(await db.WorkItems.AnyAsync(w => w.Id == rollback.Id && w.Status == "registered") && !await db.DomainEvents.AnyAsync(e => e.ContextWorkItemId == rollback.Id && e.ActivityType == "information.closed"), "Rollback split terminal state and automatic lock evidence.");
        Console.WriteLine("Automatic lifecycle passed: atomic terminal locking, delivery/projection/failure gating, concurrent idempotent archive, paused editing, preservation, independent protected learning, Site isolation, archive/all/search hierarchy and rollback.");
    }
    private static async Task VerifyUpgrade(FylkrenDbContext source)
    {
        var schema = "synthetic_hold_upgrade_" + Guid.NewGuid().ToString("N");
        await LegacyHoldUpgradeTests.SchemaCommand(source, "CREATE SCHEMA", schema);
        try
        {
            var connection = new Npgsql.NpgsqlConnectionStringBuilder(source.Database.GetConnectionString()) { SearchPath = schema };
            await using var db = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection.ConnectionString).Options);
            await db.GetService<IMigrator>().MigrateAsync("20261003211918_ReconcileActivityConsumers");
            var old = DateTimeOffset.UtcNow.AddDays(-10); var site = new Site(Guid.NewGuid(), "Synthetic pre-automatic migration", old);
            db.Sites.Add(site); await db.SaveChangesAsync();
            var instance = Guid.NewGuid(); var work = Guid.NewGuid(); var lifecycle = Guid.NewGuid();
            await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO instance_identity(key,instance_id,created_at) VALUES(1,{instance},{old}) ON CONFLICT(key) DO UPDATE SET instance_id=EXCLUDED.instance_id");
            await using (var tx = await db.Database.BeginTransactionAsync())
            {
                await db.Database.ExecuteSqlRawAsync("SELECT set_config('fylkren.activity_writer','1',true)");
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO work_items(id,site_id,title,description,sender_site_name,priority,status,created_at,updated_at,reference_code,reference_number) VALUES({work},{site.Id},'Historical reopened work','Synthetic','Synthetic legacy sender','normal','rejected',{old},{old},'UPGRADE-1',1)");
                await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO information_lifecycle(id,owner_site_id,resource_type,resource_id,context_work_item_id,stage,version,is_held,reason,changed_at) VALUES({lifecycle},{site.Id},'work_item',{work},{work},'active',1,false,'Explicit historical reopening',{old})");
                var fact = DomainEvent.Create(Guid.NewGuid(), "information.restored", site.Id, "work_item", work, work,
                    new DomainEventContext("system", "system", instance, site.Id, Guid.NewGuid(), ActorSystem: "synthetic-upgrade"), "{\"status\":\"active\"}", old, old, "historical-reopen");
                db.DomainEvents.Add(fact); await db.SaveChangesAsync(); await tx.CommitAsync();
            }
            var originalCount = await db.DomainEvents.CountAsync();
            await db.Database.MigrateAsync();
            var state = await db.InformationLifecycles.SingleAsync(l => l.Id == lifecycle);
            Require(state.AutomationPaused && state.Stage == "active", "Upgrade silently undid an explicit historical reopening.");
            Require(await db.DomainEvents.CountAsync() == originalCount && !await db.EventProjections.AnyAsync(), "Upgrade fabricated activity or dispatched historical deliveries.");
            await WorkLifecycleWorker.Reconcile(work, db, default); Require(state.Stage == "active", "Startup undid the migrated editing pause.");
            try { await db.GetService<IMigrator>().MigrateAsync("20261003211918_ReconcileActivityConsumers"); throw new Exception("Pause-aware downgrade was accepted."); }
            catch (Npgsql.PostgresException e) when (e.ConstraintName == "activity_cutover_forward_fix_required") { }
        }
        finally { await LegacyHoldUpgradeTests.SchemaCommand(source, "DROP SCHEMA", schema, " CASCADE"); }
    }
    private static async Task Forbidden(FylkrenDbContext db, string sql, string constraint)
    {
        await using var tx = await db.Database.BeginTransactionAsync(); await db.Database.ExecuteSqlRawAsync("SELECT set_config('fylkren.activity_writer','1',true)");
        try { await db.Database.ExecuteSqlRawAsync(sql); throw new Exception("Forbidden historic mutation succeeded."); }
        catch (Npgsql.PostgresException error) when (error.ConstraintName == constraint) { }
        await tx.RollbackAsync();
    }
}
