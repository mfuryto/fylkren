using Microsoft.EntityFrameworkCore.Infrastructure;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

internal static class WorkSliceTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        db.ChangeTracker.Clear(); await db.Database.MigrateAsync();
        await db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().MigrateAsync("20261002211913_AddActivityLifecycleFoundation");
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow; var site = await db.Sites.Select(x => x.Id).FirstAsync(); var root = Guid.NewGuid();
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO instance_identity(key,instance_id,created_at) VALUES(1,{Guid.NewGuid()},{now}) ON CONFLICT(key) DO NOTHING");
        if (!await db.PlatformReferenceSettings.AnyAsync()) db.PlatformReferenceSettings.Add(new(3, 1, now, null));
        if (!await db.SiteReferenceSettings.AnyAsync(x => x.SiteId == site)) db.SiteReferenceSettings.Add(new(site, "TEST", now, null));
        await db.SaveChangesAsync();
        var item = new WorkItem(root, site, null, "Synthetic archive task", "No private metadata", null, "normal", null, now, senderSiteName: "Synthetic sender");
        db.WorkItems.Add(item);
        var audit = AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-command", "work-item.registered", "work-item", root, now);
        WorkActivity.Add(db, audit, "task.created");
        var legacy = DomainEventRecorder.Record(db, "task.created", site, null, "task", root, new { taskId = root, title = item.Title }, now);
        await db.SaveChangesAsync();
        var fact = await db.DomainEvents.AsNoTracking().SingleAsync(x => x.ContextWorkItemId == root);
        Require(fact.Id == legacy.Id && fact.EventType == "task.created" && System.Text.Json.Nodes.JsonNode.DeepEquals(System.Text.Json.Nodes.JsonNode.Parse(fact.PayloadJson), System.Text.Json.Nodes.JsonNode.Parse(legacy.PayloadJson)) && fact.ActivityType == "task.created", "v1 event was duplicated or changed.");
        Require(fact.Source == "system" && fact.ContextWorkItemId == root && audit.DomainEventId == fact.Id, "Command fact/audit correlation lost.");
        Require(!fact.ActivityMetadataJson.Contains(item.Title), "Private content leaked into activity metadata.");
        Require(await db.EventProjections.CountAsync(x => x.DomainEventId == fact.Id) == 2, "Shared projections missing.");
        Require((await db.EventProjections.SingleAsync(x => x.DomainEventId == fact.Id && x.Consumer == "notifications")).Status == "skipped", "Notification eligibility not frozen.");
        var state = await db.InformationLifecycles.SingleAsync(x => x.ResourceId == root);
        Require(state.Stage == "active" && item.Status == "registered", "Lifecycle replaced operational state.");
        var rolledBackAudit = AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-command", "work-item.updated", "work-item", root, now);
        var rolledBackMessageId = Guid.NewGuid();
        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            item.TransitionWithinLevel("under_review", "Synthetic rollback", now);
            WorkActivity.Add(db, rolledBackAudit, "assignment.accepted");
            await db.SaveChangesAsync();
            var rolledBackMessage = new Fylkren.Api.Notifications.NotificationOutboxMessage(rolledBackMessageId,
                rolledBackAudit.Id, site, root, Guid.NewGuid(), "synthetic@example.invalid", "Synthetic recipient",
                "Synthetic rollback", "Frozen synthetic message", "Synthetic site", now);
            rolledBackMessage.LinkEvent(rolledBackAudit.DomainEventId!.Value, "work-item-changes");
            db.NotificationOutboxMessages.Add(rolledBackMessage);
            await db.SaveChangesAsync();
            await transaction.RollbackAsync();
        }
        db.ChangeTracker.Clear();
        item = await db.WorkItems.SingleAsync(x => x.Id == root);
        state = await db.InformationLifecycles.SingleAsync(x => x.ResourceId == root);
        Require(item.Status == "registered" && !await db.AuditEvents.AnyAsync(x => x.Id == rolledBackAudit.Id) &&
            !await db.NotificationOutboxMessages.AnyAsync(x => x.Id == rolledBackMessageId) &&
            await db.DomainEvents.CountAsync(x => x.ContextWorkItemId == root) == 1 &&
            await db.EventProjections.CountAsync(x => db.DomainEvents.Any(e => e.Id == x.DomainEventId && e.ContextWorkItemId == root)) == 2,
            "Rollback split authoritative state, audit, activity or projection records.");
        item.TransitionWithinLevel("rejected", "Synthetic terminal state", now); await db.SaveChangesAsync();
        var foreignSite = Guid.NewGuid();
        db.Sites.Add(new Fylkren.Api.Organization.Site(foreignSite, "Synthetic independent owner", now));
        db.SiteReferenceSettings.Add(new(foreignSite, "FOREIGN", now, null));
        await db.SaveChangesAsync();
        var ownChild = new WorkItem(Guid.NewGuid(), site, null, "Synthetic owned child", "", null, "normal", null, now, parentWorkItemId: root, senderSiteName: "Synthetic source owner");
        var foreignChild = new WorkItem(Guid.NewGuid(), foreignSite, null, "Synthetic foreign child", "", null, "normal", null, now, parentWorkItemId: root, senderSiteName: "Synthetic source owner");
        db.WorkItems.AddRange(ownChild, foreignChild);
        foreach (var child in new[] { ownChild, foreignChild })
            WorkActivity.Add(db, AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-command", "work-item.registered", "work-item", child.Id, now), "task.created");
        await db.SaveChangesAsync();
        Require(!await WorkLifecycleEndpoints.Eligible(item, db, default), "Unfinished owned child did not block closure.");
        ownChild.TransitionWithinLevel("rejected", "Synthetic owned child closure", now);
        await db.SaveChangesAsync();
        Require(await WorkLifecycleEndpoints.Eligible(item, db, default), "Independent foreign work blocked the owning site's closure.");
        await Blocked(db, $"INSERT INTO workflow_runs(id,work_item_id) VALUES('{Guid.NewGuid()}','{root}')", "activity_writer_gate");
        await Blocked(db, $"INSERT INTO work_item_comments(id,site_id,work_item_id) VALUES('{Guid.NewGuid()}','{site}','{root}')", "activity_writer_gate");
        state.Transition("closed", state.Version, "Synthetic close", now); await db.SaveChangesAsync();
        await Blocked(db, $"UPDATE work_items SET title = 'Forbidden archive write' WHERE id = '{root}'", "activity_writer_gate");
        await BlockedWithWriter(db, $"UPDATE work_items SET title = 'Forbidden supported write' WHERE id = '{root}'");
        await BlockedWithWriter(db, $"INSERT INTO work_item_comments(id,site_id,work_item_id) VALUES('{Guid.NewGuid()}','{site}','{root}')");
        await BlockedWithWriter(db, $"INSERT INTO learning_lessons(id,site_id,work_item_id) VALUES('{Guid.NewGuid()}','{site}','{root}')");
        await BlockedWithWriter(db, $"INSERT INTO risks(id,site_id,object_type,object_id) VALUES('{Guid.NewGuid()}','{site}','task','{root}')");
        await BlockedWithWriter(db, $"INSERT INTO workflow_runs(id,work_item_id) VALUES('{Guid.NewGuid()}','{root}')");
        await BlockedWithWriter(db, $"UPDATE work_items SET title = 'Forbidden descendant write' WHERE id = '{ownChild.Id}'");
        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            await db.Database.ExecuteSqlRawAsync("SELECT set_config('fylkren.activity_writer','1',true)");
            await db.Database.ExecuteSqlInterpolatedAsync($"UPDATE work_items SET title = 'Independent owner preserved' WHERE id = {foreignChild.Id}");
            await transaction.CommitAsync();
        }
        Require(await db.WorkItems.AsNoTracking().AnyAsync(x => x.Id == foreignChild.Id && x.ParentWorkItemId == root && x.Title == "Independent owner preserved"), "Foreign owner was frozen or its historical reference lost.");
        state.Transition("archived", state.Version, "Synthetic archive", now); await db.SaveChangesAsync();
        await BlockedWithWriter(db, $"DELETE FROM work_items WHERE id = '{root}'");
        state.Transition("closed", state.Version, "Synthetic restore", now); await db.SaveChangesAsync();
        state.Transition("active", state.Version, "Synthetic reopen", now); await db.SaveChangesAsync();
        item.TransitionWithinLevel("under_review", "Restored information", now); await db.SaveChangesAsync();
        Require((await db.WorkItems.AsNoTracking().SingleAsync(x => x.Id == root)).Title == "Synthetic archive task", "Blocked mutation persisted.");
        Require(await db.DomainEvents.CountAsync(x => x.ContextWorkItemId == root) == 1 && await db.AuditEvents.AnyAsync(x => x.Id == audit.Id), "Historical evidence disappeared.");
        var queueId = Guid.NewGuid();
        db.NotificationOutboxMessages.Add(new(queueId, audit.Id, site, root, Guid.NewGuid(), "synthetic@example.invalid", "Synthetic recipient", "Frozen subject", "Frozen body", "Synthetic site", now));
        var subscription = new WebhookSubscription(Guid.NewGuid(), site, "Synthetic subscription", "https://example.invalid", "synthetic-protected-placeholder", "task.created", Guid.NewGuid(), now);
        db.WebhookSubscriptions.Add(subscription);
        var delivery = new WebhookDelivery(Guid.NewGuid(), subscription.Id, fact.Id, now); db.WebhookDeliveries.Add(delivery); await db.SaveChangesAsync();
        await using (var competitor = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(db.Database.GetConnectionString()).Options))
        {
            var smtpClaims = await Task.WhenAll(DeliveryClaims.Notification(db, queueId, now, default), DeliveryClaims.Notification(competitor, queueId, now, default));
            Require(smtpClaims.Sum() == 1, "Two SMTP workers claimed the same message.");
            Require(await DeliveryClaims.Notification(db, queueId, now.AddMinutes(6), default) == 1, "Abandoned SMTP lease did not recover.");
            var webhookClaims = await Task.WhenAll(DeliveryClaims.Webhook(db, delivery.Id, now, default), DeliveryClaims.Webhook(competitor, delivery.Id, now, default));
            Require(webhookClaims.Sum() == 1, "Two webhook workers claimed the same delivery.");
            Require(await DeliveryClaims.Webhook(db, delivery.Id, now.AddMinutes(6), default) == 1, "Abandoned webhook lease did not recover.");
        }
        var oldAudit = AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-peer", "federation-retention-fixture", "work-item", root, now.AddDays(-3000));
        db.AuditEvents.Add(oldAudit); await db.SaveChangesAsync();
        await Fylkren.Api.Platform.ApiMaintenanceWorker.RemoveExpiredFederationHistory(db, now, 2555, Microsoft.Extensions.Logging.Abstractions.NullLogger.Instance, default);
        Require(await db.AuditEvents.AnyAsync(x => x.Id == oldAudit.Id), "Transport housekeeping erased independent audit.");
        await Blocked(db, $"UPDATE domain_events SET payload_json = '{{}}'::jsonb WHERE id = '{fact.Id}'", "domain_activity_immutable");
        try { await db.GetService<Microsoft.EntityFrameworkCore.Migrations.IMigrator>().MigrateAsync("20261002211913_AddActivityLifecycleFoundation"); throw new Exception("Downgrade after cutover was accepted."); }
        catch (Npgsql.PostgresException error) when (error.ConstraintName == "activity_cutover_forward_fix_required") { }
        Console.WriteLine("Work slice database tests passed: one v1/canonical fact, audit correlation, frozen eligibility, lifecycle separation, old-writer rejection, content guards, restore and history preservation.");
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    private static async Task Blocked(FylkrenDbContext db, string sql, string constraint)
    {
        try { await db.Database.ExecuteSqlRawAsync(sql.Replace("{", "{{").Replace("}", "}}")); throw new Exception("Forbidden database write succeeded."); }
        catch (Npgsql.PostgresException error) when (error.ConstraintName == constraint) { }
    }
    private static async Task BlockedWithWriter(FylkrenDbContext db, string sql)
    {
        await using var tx = await db.Database.BeginTransactionAsync();
        await db.Database.ExecuteSqlRawAsync("SELECT set_config('fylkren.activity_writer','1',true)");
        await Blocked(db, sql, "work_lifecycle_guard"); await tx.RollbackAsync();
    }
}
