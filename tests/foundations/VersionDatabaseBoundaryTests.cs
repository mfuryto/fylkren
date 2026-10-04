using Fylkren.Api;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Approvals;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

internal static class VersionDatabaseBoundaryTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        void Require(bool value, string message) { if (!value) throw new Exception(message); }
        await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), "Synthetic foundation site", now);
        var person = new Fylkren.Api.Identity.Person(Guid.NewGuid(), "Synthetic version author", now);
        db.Sites.Add(site); db.People.Add(person);
        if (!await db.PlatformReferenceSettings.AnyAsync()) db.PlatformReferenceSettings.Add(new(3, 1, now, null));
        db.SiteReferenceSettings.Add(new(site.Id, "VRS", now, person.Id));
        await db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO instance_identity(key,instance_id,created_at) VALUES(1,{Guid.NewGuid()},{now}) ON CONFLICT(key) DO NOTHING");
        await db.SaveChangesAsync();
        var work = new WorkItem(Guid.NewGuid(), site.Id, person.Id, "Synthetic version root", "Synthetic", null, "normal", null, now);
        db.WorkItems.Add(work);
        WorkActivity.Add(db, AuditEvent.FromSystem(Guid.NewGuid(), "synthetic-version-test", "work-item.registered", "work-item", work.Id, now), "task.created");
        await db.SaveChangesAsync();
        db.DomainObjectVersions.Add(new DomainObjectVersion(Guid.NewGuid(), site.Id, "work_item", work.Id, work.Id,
            int.MaxValue - 1, "Synthetic historical boundary", "{}", new string('a', 64), person.Id, now));
        await db.SaveChangesAsync();
        var final = await FormalApprovalService.Approve(db, site.Id, "work_item", work.Id, work.Id,
            "Synthetic last version", new { synthetic = true }, person.Id, now, default);
        Require(final.VersionNumber == int.MaxValue, "Formal approval lost the last integer version.");
        await db.SaveChangesAsync(); db.ChangeTracker.Clear();
        var versions = await db.DomainObjectVersions.CountAsync(); var audits = await db.AuditEvents.CountAsync();
        try
        {
            await FormalApprovalService.Approve(db, site.Id, "work_item", work.Id, work.Id,
                "Synthetic rejected capacity", new { synthetic = true }, person.Id, now, default);
            throw new Exception("Formal approval version wrapped.");
        }
        catch (NumericCapacityException) { }
        Require(!db.ChangeTracker.Entries().Any(entry => entry.State == EntityState.Added), "Rejected capacity staged approval/signoff/audit effects.");
        Require(await db.DomainObjectVersions.CountAsync() == versions && await db.AuditEvents.CountAsync() == audits,
            "Rejected capacity changed immutable history.");
        var fact = await db.DomainEvents.FirstAsync(value => value.ContextWorkItemId == work.Id);
        var subscription = new WebhookSubscription(Guid.NewGuid(), site.Id, "Synthetic capacity receiver", "https://example.invalid/sink",
            "Synthetic opaque secret", "task.created", person.Id, now);
        var delivery = new WebhookDelivery(Guid.NewGuid(), subscription.Id, fact.Id, now);
        db.WebhookSubscriptions.Add(subscription); db.WebhookDeliveries.Add(delivery);
        db.Entry(delivery).Property(value => value.AttemptCount).CurrentValue = int.MaxValue - 1;
        await db.SaveChangesAsync();
        Require(await DeliveryClaims.Webhook(db, delivery.Id, now, default) == 1, "Last SQL claim attempt was rejected.");
        var last = await db.WebhookDeliveries.AsNoTracking().SingleAsync(value => value.Id == delivery.Id);
        Require(last.AttemptCount == int.MaxValue, "SQL claim did not preserve its last attempt.");
        Require(await DeliveryClaims.Webhook(db, delivery.Id, now.AddMinutes(6), default) == 0, "SQL claim incremented past capacity.");
        var unchanged = await db.WebhookDeliveries.AsNoTracking().SingleAsync(value => value.Id == delivery.Id);
        Require(unchanged.AttemptCount == last.AttemptCount && unchanged.Status == last.Status && unchanged.LastAttemptAt == last.LastAttemptAt,
            "Rejected SQL capacity partially changed the delivery lease.");
        await db.WebhookDeliveries.Where(value => value.Id == delivery.Id).ExecuteUpdateAsync(setters => setters.SetProperty(value => value.AttemptCount, -1));
        Require(await DeliveryClaims.Webhook(db, delivery.Id, now.AddMinutes(6), default) == 0, "SQL claim accepted a negative counter.");
        Require((await db.WebhookDeliveries.AsNoTracking().SingleAsync(value => value.Id == delivery.Id)).AttemptCount == -1,
            "Rejected SQL sign boundary changed the stored counter.");
        db.ChangeTracker.Clear();
        Console.WriteLine("Version database boundaries passed: formal int-max approval then atomic rejection with immutable history/audit preserved; SQL webhook claim at int-max then zero mutation.");
    }
}
