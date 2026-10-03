using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Identity;
using Fylkren.Api.Notifications;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using System.Data.Common;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;

internal static class ConsumerReconciliationTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        db.ChangeTracker.Clear();
        await VerifyWebhookUpgrade(db);
        var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), "Synthetic consumer reconciliation", now);
        var person = new Person(Guid.NewGuid(), "Synthetic queue recipient", now, "recipient@example.invalid");
        var unit = new OrganizationUnit(Guid.NewGuid(), site.Id, null, "Synthetic leader level", false, now, isSiteLeadership: true);
        var role = new OrganizationRole(Guid.NewGuid(), unit.Id, "Synthetic leader", true, now);
        db.Sites.Add(site); db.People.Add(person); db.OrganizationUnits.Add(unit); db.OrganizationRoles.Add(role);
        db.RoleAssignments.Add(new RoleAssignment(Guid.NewGuid(), role.Id, person.Id, now.AddDays(-1), null, now));
        db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), site.Id, person.Id, now));
        db.SiteReferenceSettings.Add(new SiteReferenceSettings(site.Id, "RECN", now, person.Id));
        var settings = new SiteNotificationSettings(Guid.NewGuid(), site.Id); settings.Update(true, true, true, true, true, true); db.SiteNotificationSettings.Add(settings);
        if (!await db.NotificationTemplates.AnyAsync(t => t.Key == "new-work-item")) db.NotificationTemplates.Add(new NotificationTemplate(Guid.NewGuid(), "new-work-item", "{title}", "{link}"));
        var cursor = new NotificationProjectionCursor(LegacyNotificationReconciliation.CursorId, now.AddHours(-1), Guid.Empty); db.NotificationProjectionCursors.Add(cursor);
        await db.SaveChangesAsync();
        var item = new WorkItem(Guid.NewGuid(), site.Id, person.Id, "Synthetic backlog snapshot", "", null, "normal", null, now); db.WorkItems.Add(item);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), site.Id, person.Id, "work-item.registered", "work-item", item.Id, now), "task.created"); await db.SaveChangesAsync();
        var old = new AuditEvent(Guid.NewGuid(), site.Id, person.Id, "work-item.registered", "work-item", item.Id, now.AddMinutes(-1)); db.AuditEvents.Add(old);
        db.NotificationOutboxMessages.Add(new NotificationOutboxMessage(Guid.NewGuid(), old.Id, site.Id, item.Id, person.Id, person.Email!, person.DisplayName, "Previously frozen legacy subject", "Previously frozen legacy content", site.Name, old.OccurredAt));
        // More than one durable batch, including identical timestamps with UUID ordering.
        for (var i = 0; i < 205; i++) db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), site.Id, person.Id, "legacy.non-notifying-administration", "site", site.Id, now.AddMinutes(-1)));
        var missed = new AuditEvent(Guid.NewGuid(), site.Id, person.Id, "work-item.registered", "work-item", item.Id, now); db.AuditEvents.Add(missed); await db.SaveChangesAsync();
        var beforeFacts = await db.DomainEvents.CountAsync();
        // Roll back a cancelled drain; no persisted cursor/projection progress may leak.
        using (var cancelled = new CancellationTokenSource())
        {
            cancelled.Cancel();
            try { await LegacyNotificationReconciliation.Run(db, "https://synthetic.invalid", cancelled.Token); throw new Exception("Cancelled reconciliation succeeded."); } catch (OperationCanceledException) { }
        }
        Require(!await db.NotificationProjectionCursors.AsNoTracking().AnyAsync(c => c.ReconciledAt != null), "Cancelled drain marked cutover complete.");
        var connection = db.Database.GetConnectionString()!;
        await using (var interrupted = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection).AddInterceptors(new InterruptSecondBatch()).Options))
        {
            try { await LegacyNotificationReconciliation.Run(interrupted, "https://synthetic.invalid", default); throw new Exception("Second-batch interrupt was not exercised."); } catch (OperationCanceledException) { }
        }
        var checkpoint = await db.NotificationProjectionCursors.AsNoTracking().SingleAsync(c => c.Id == cursor.Id);
        Require(checkpoint.ReconciledAt is null && checkpoint.LastOccurredAt > now.AddHours(-1), "Interrupted drain did not retain its first durable batch.");
        await using (var second = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection).Options))
            await Task.WhenAll(LegacyNotificationReconciliation.Run(db, "https://synthetic.invalid", default), LegacyNotificationReconciliation.Run(second, "https://synthetic.invalid", default));
        Require(await db.NotificationOutboxMessages.CountAsync(m => m.AuditEventId == old.Id) == 1, "Legacy frozen delivery was duplicated.");
        Require((await db.NotificationOutboxMessages.SingleAsync(m => m.AuditEventId == old.Id)).Subject == "Previously frozen legacy subject", "Legacy delivery content was rewritten.");
        Require(await db.NotificationOutboxMessages.CountAsync(m => m.AuditEventId == missed.Id) == 1, "Unconsumed legacy obligation was lost.");
        Require(await db.DomainEvents.CountAsync() == beforeFacts, "Reconciliation fabricated a second business history.");
        var count = await db.NotificationOutboxMessages.CountAsync(); await LegacyNotificationReconciliation.Run(db, "https://synthetic.invalid", default);
        Require(await db.NotificationOutboxMessages.CountAsync() == count, "Completed drain reprojected history.");
        try { await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO audit_events(id,site_id,actor_person_id,event_type,entity_type,entity_id,occurred_at,actor_was_platform_manager) VALUES({Guid.NewGuid()},{site.Id},{person.Id},'work-item.registered','work-item',{item.Id},{now},false)"); throw new Exception("Old operational audit writer bypassed completed cutover."); } catch (Npgsql.PostgresException e) when (e.ConstraintName == "activity_consumer_cutover") { }
        try { await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO domain_events(id,event_type,schema_version,occurred_at,site_id,actor_person_id,resource_type,resource_id,payload_json,source) VALUES({Guid.NewGuid()},'task.created',1,{now},{site.Id},{person.Id},'task',{item.Id},'{{}}'::jsonb,'legacy')"); throw new Exception("New legacy event bypassed completed cutover."); } catch (Npgsql.PostgresException e) when (e.ConstraintName == "activity_consumer_cutover") { }
        var machine = new ApiMachineIdentity(Guid.NewGuid(), "Synthetic machine actor", "testkey000001", [1], [2], "sites:write", null, now); db.ApiMachineIdentities.Add(machine);
        var machineAudit = new ApiMachineAuditEvent(Guid.NewGuid(), machine.Id, site.Id, "site.updated", "site", site.Id, "synthetic-machine-request", now); db.ApiMachineAuditEvents.Add(machineAudit);
        await DomainEventRecorder.RecordMachineGovernance(db, machineAudit, default); await db.SaveChangesAsync();
        var fact = await db.DomainEvents.SingleAsync(e => e.Id == machineAudit.DomainEventId);
        Require(fact.ActorKind == "machine" && fact.ActorMachineId == machine.Id && fact.ActorPersonId is null && fact.RequestId == machineAudit.CorrelationId, "Machine attribution was replaced by a person/system fiction.");
        Require(await db.EventProjections.CountAsync(p => p.DomainEventId == fact.Id && p.Status == "skipped") == 2, "Administrative machine activity scheduled a disclosure.");
        var portableMachine = await Fylkren.Api.Portability.PortableExportPackage.Create(site.Id, person.Id, db, default);
        Require((await Fylkren.Api.Portability.PortableImportValidator.Validate(new MemoryStream(portableMachine), site.Id, default)).Valid, "Machine audit request identifiers broke portable export.");
        var definition = new WorkflowDefinition(Guid.NewGuid(), site.Id, null, "Synthetic released plan", "planning", false); db.WorkflowDefinitions.Add(definition);
        var plan = new WorkflowRun(Guid.NewGuid(), item.Id, definition.Id); plan.Claim(person.Id, now); db.WorkflowRuns.Add(plan);
        var execution = new ExecutionRun(Guid.NewGuid(), item.Id, person.Id, now); db.ExecutionRuns.Add(execution); await db.SaveChangesAsync();
        AccessActivity.Release(db, plan, now, "synthetic-access-change"); await db.SaveChangesAsync();
        var accessFact = await db.DomainEvents.SingleAsync(e => e.ResourceId == plan.Id);
        Require(accessFact.ActorSystem == "access-lifecycle" && await db.AuditEvents.AnyAsync(a => a.DomainEventId == accessFact.Id && a.SiteId == site.Id), "Shared-user access effect lost typed system owner/audit.");
        plan.Claim(person.Id, now); await db.SaveChangesAsync();
        await SiteDeactivationService.DeactivateAsync(site, db, now, default); await db.SaveChangesAsync();
        foreach (var run in new[] { plan.Id, execution.Id })
        {
            var release = await db.DomainEvents.SingleAsync(e => e.ResourceId == run && e.ActorSystem == "site-deactivation");
            Require(release.Source == "system" && release.ActorSystem == "site-deactivation" && release.ContextWorkItemId == item.Id && release.ActivityType == "assignment.released", "Automatic run release omitted or misattributed activity.");
            Require(await db.AuditEvents.AnyAsync(a => a.DomainEventId == release.Id && a.SiteId == site.Id), "Automatic release lost independent owning-Site audit.");
        }
        Console.WriteLine("Consumer reconciliation passed: concurrent resumable bounded drain, cancellation, existing frozen-delivery deduplication, backlog preservation, no invented activity/backfill dispatch, completed idempotence, old-writer guards and typed machine audit correlation.");
    }
    private static async Task VerifyWebhookUpgrade(FylkrenDbContext source)
    {
        var schema = "synthetic_hold_upgrade_" + Guid.NewGuid().ToString("N");
        await LegacyHoldUpgradeTests.SchemaCommand(source, "CREATE SCHEMA", schema);
        try
        {
            var builder = new Npgsql.NpgsqlConnectionStringBuilder(source.Database.GetConnectionString()) { SearchPath = schema };
            await using var db = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(builder.ConnectionString).Options);
            var before = db.GetService<IMigrationsAssembly>().Migrations.Keys.Single(m => m.EndsWith("_AddPreservationAndSnapshotReceipts"));
            await db.GetService<IMigrator>().MigrateAsync(before);
            var at = DateTimeOffset.UtcNow.AddDays(-10); var site = new Site(Guid.NewGuid(), "Synthetic legacy webhook", at); db.Sites.Add(site);
            var actor = Guid.NewGuid();
            var pending = new DomainEvent(Guid.NewGuid(), "task.created", 1, at, site.Id, actor, "task", Guid.NewGuid(), "{\"legacy\":true}");
            var projected = new DomainEvent(Guid.NewGuid(), "task.created", 1, at, site.Id, actor, "task", Guid.NewGuid(), "{}"); projected.MarkWebhooksProjected(at);
            var unsupported = new DomainEvent(Guid.NewGuid(), "legacy.private-administration", 1, at, site.Id, actor, "site", site.Id, "{}");
            db.DomainEvents.AddRange(pending, projected, unsupported); await db.SaveChangesAsync();
            await db.Database.MigrateAsync();
            var marker = await db.EventProjections.AsNoTracking().SingleAsync(p => p.DomainEventId == pending.Id);
            Require(marker.Consumer == "webhooks" && marker.Status == "pending", "Eligible unprojected legacy webhook was lost.");
            Require(!await db.EventProjections.AnyAsync(p => p.DomainEventId == projected.Id), "Projected historical webhook was scheduled again.");
            Require((await db.EventProjections.SingleAsync(p => p.DomainEventId == unsupported.Id)).Status == "skipped", "Unknown private legacy type was scheduled for external delivery.");
            var fact = await db.DomainEvents.AsNoTracking().SingleAsync(e => e.Id == pending.Id);
            Require(fact.Source == "legacy" && fact.ActivityType is null && fact.PayloadJson.Contains("legacy"), "Upgrade invented provenance or rewrote v1 data.");
            await db.GetService<IMigrator>().MigrateAsync(before); await db.Database.MigrateAsync();
            Require(await db.EventProjections.CountAsync(p => p.DomainEventId == pending.Id) == 1, "Pre-cutover retry duplicated a webhook obligation.");
        }
        finally { await LegacyHoldUpgradeTests.SchemaCommand(source, "DROP SCHEMA", schema, " CASCADE"); }
    }
    private sealed class InterruptSecondBatch : DbCommandInterceptor
    {
        private int batches;
        public override ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken ct = default)
        {
            if (command.CommandText.Contains("FROM audit_events", StringComparison.Ordinal) && ++batches == 2) throw new OperationCanceledException("Synthetic interrupted upgrade batch");
            return ValueTask.FromResult(result);
        }
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
}
