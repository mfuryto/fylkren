using System.Data.Common;
using System.IO.Compression;
using System.Text.Json;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Federation;
using Fylkren.Api.Identity;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.Portability;
using Fylkren.Api.Risks;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Logging.Abstractions;

internal static class PreservationTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        db.ChangeTracker.Clear();
        var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), "Snapshot before concurrent change", now);
        var foreign = new Site(Guid.NewGuid(), "FOREIGN_PRIVATE_SENTINEL", now);
        var author = new Person(Guid.NewGuid(), "Synthetic portable author", now);
        var owner = new Person(Guid.NewGuid(), "Historical risk owner without membership", now);
        db.Sites.AddRange(site, foreign); db.People.AddRange(author, owner);
        db.SiteReferenceSettings.AddRange(new SiteReferenceSettings(site.Id, "PRSV", now, author.Id), new SiteReferenceSettings(foreign.Id, "FRGN", now, author.Id));
        await db.SaveChangesAsync();
        var item = new WorkItem(Guid.NewGuid(), site.Id, author.Id, "Snapshot work before concurrent change", "", null, "normal", null, now);
        var other = new WorkItem(Guid.NewGuid(), foreign.Id, author.Id, "FOREIGN_PRIVATE_WORK", "", null, "normal", null, now);
        item.TransitionWithinLevel("rejected", "Synthetic terminal work", now); other.TransitionWithinLevel("rejected", "Synthetic terminal work", now);
        db.WorkItems.AddRange(item, other);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), site.Id, author.Id, "work-item.registered", "work-item", item.Id, now), "task.created");
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), foreign.Id, author.Id, "work-item.registered", "work-item", other.Id, now), "task.created");
        await db.SaveChangesAsync();
        var risk = new Risk(Guid.NewGuid(), site.Id, "task", item.Id, author.Id, now);
        db.Risks.Add(risk); db.RiskRevisions.Add(new RiskRevision(Guid.NewGuid(), risk.Id, 1, "Synthetic risk", "", 3, 4, owner.Id, "Historical owner", "identified", null, null, null, author.Id, now));
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), site.Id, author.Id, "risk.created", "risk", risk.Id, now), "risk.created", workItemId: item.Id, resourceType: "risk");
        var root = new InformationLifecycleRecord(Guid.NewGuid(), site.Id, "site", site.Id, null, now); db.InformationLifecycles.Add(root);
        var policy = new RetentionPolicyVersion(Guid.NewGuid(), 1, "No automatic disposal", "content", null, author.Id, now);
        db.RetentionPolicyVersions.Add(policy); root.BindPolicy(policy.PolicyId, 1, root.Version, "Explicit review", now);
        await db.SaveChangesAsync();
        var connection = db.Database.GetConnectionString()!;
        var interceptor = new ConcurrentChange(connection, site.Id, item.Id);
        byte[] bytes;
        await using (var export = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection).AddInterceptors(interceptor).Options))
            bytes = await PortableExportPackage.Create(site.Id, author.Id, export, default);
        Require(interceptor.Fired, "Concurrent snapshot test did not execute its independent writer.");
        using (var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read))
        {
            var text = string.Join("\n", zip.Entries.Select(e => { using var reader = new StreamReader(e.Open()); return reader.ReadToEnd(); }));
            Require(text.Contains("Snapshot before concurrent change") && text.Contains("Snapshot work before concurrent change") && !text.Contains("AFTER_SNAPSHOT") && !text.Contains("FOREIGN_PRIVATE"), "Export mixed snapshots or exposed foreign content.");
            Require(text.Contains(owner.Id.ToString()), "Historical risk owner reference was not closed.");
            var manifest = JsonDocument.Parse(zip.GetEntry("manifest.json")!.Open()).RootElement;
            Require(manifest.GetProperty("formatVersion").GetString() == "1.1" && manifest.GetProperty("snapshot").GetProperty("boundary").GetString()!.Length == 64, "Snapshot evidence missing.");
        }
        var validation = await PortableImportValidator.Validate(new MemoryStream(bytes), site.Id, default);
        Require(validation.Valid, "Generated package rejected: " + string.Join("; ", validation.Errors));
        await PortableValidationTests.Run(bytes, site.Id);
        db.ChangeTracker.Clear();
        Require((await db.Sites.AsNoTracking().SingleAsync(s => s.Id == site.Id)).Name == "AFTER_SNAPSHOT_SITE", "Independent concurrent writer did not commit.");
        var receipt = await db.ExportReceipts.SingleAsync(r => r.SiteId == site.Id);
        Require(receipt.PackageSha256 == PortableExportPackage.Hash(bytes) && receipt.PackageBytes == bytes.Length, "Receipt does not identify the saved artifact.");
        Reject(() => receipt.Acknowledge(receipt.Version, author.Id, new string('0', 64), "Wrong artifact", now));
        Reject(() => receipt.Acknowledge(0, author.Id, receipt.PackageSha256, "Stale version", now));
        receipt.Acknowledge(receipt.Version, author.Id, receipt.PackageSha256, "Synthetic recipient verified saved package", now); await db.SaveChangesAsync();
        Reject(() => receipt.Acknowledge(receipt.Version, author.Id, receipt.PackageSha256, "Duplicate acknowledgement", now));
        var audits = await db.AuditEvents.CountAsync(); var receipts = await db.ExportReceipts.CountAsync();
        try { await PortableExportPackage.Create(site.Id, author.Id, db, default, 1024); throw new Exception("Bounded export unexpectedly succeeded."); } catch (PortablePackageTooLargeException) { }
        await db.SaveChangesAsync();
        Require(await db.AuditEvents.CountAsync() == audits && await db.ExportReceipts.CountAsync() == receipts, "Failed export created a success receipt/audit.");
        db.ChangeTracker.Clear(); root = await db.InformationLifecycles.SingleAsync(l => l.ResourceType == "site" && l.ResourceId == site.Id);
        var hold = new LifecycleHold(Guid.NewGuid(), root.Id, author.Id, "Preserve transport evidence", now); db.LifecycleHolds.Add(hold); root.SetHold(true, root.Version, hold.Reason, now);
        var peer = new FederationPeer(Guid.NewGuid(), "Synthetic peer", "https://synthetic.invalid", now); db.FederationPeers.Add(peer);
        FederationOutboundMessage Message(WorkItem work) { var m = new FederationOutboundMessage(Guid.NewGuid(), peer.InstanceId, work.SiteId, Guid.NewGuid(), peer.InstanceId, work.SiteId, work.Id, "work.assignment", 1, "{\"private\":\"PROTOCOL_PAYLOAD_SENTINEL\"}", now.AddDays(-100)); m.MarkDelivered(now.AddDays(-99)); return m; }
        var preserved = Message(item); var disposable = Message(other); db.FederationOutboundMessages.AddRange(preserved, disposable); await db.SaveChangesAsync();
        await ApiMaintenanceWorker.RemoveExpiredFederationHistory(db, now, 30, NullLogger.Instance, default);
        Require(await db.FederationOutboundMessages.AnyAsync(m => m.MessageId == preserved.MessageId) && !await db.FederationOutboundMessages.AnyAsync(m => m.MessageId == disposable.MessageId), "Hold did not preserve its owner's transport evidence independently.");
        hold.Release(author.Id, "Release after review", now); root.SetHold(false, root.Version, "Release after review", now); await db.SaveChangesAsync();
        await ApiMaintenanceWorker.RemoveExpiredFederationHistory(db, now, 30, NullLogger.Instance, default);
        Require(!await db.FederationOutboundMessages.AnyAsync(m => m.MessageId == preserved.MessageId) && await db.AuditEvents.CountAsync() == audits, "Transport cleanup changed independent audit retention.");
        var racing = Message(item); db.FederationOutboundMessages.Add(racing); await db.SaveChangesAsync();
        await using (var writer = await db.Database.BeginTransactionAsync())
        await using (var maintenance = new FylkrenDbContext(new DbContextOptionsBuilder<FylkrenDbContext>().UseNpgsql(connection).Options))
        {
            await db.Sites.FromSqlInterpolated($"SELECT * FROM sites WHERE id={site.Id} FOR UPDATE").AsNoTracking().ToListAsync();
            var lateHold = new LifecycleHold(Guid.NewGuid(), root.Id, author.Id, "Concurrent preservation", now); db.LifecycleHolds.Add(lateHold); root.SetHold(true, root.Version, lateHold.Reason, now); await db.SaveChangesAsync();
            await maintenance.Database.OpenConnectionAsync();
            var pid = await maintenance.Database.SqlQuery<int>($"SELECT pg_backend_pid() AS \"Value\"").SingleAsync();
            var cleanup = ApiMaintenanceWorker.RemoveExpiredFederationHistory(maintenance, now, 30, NullLogger.Instance, default);
            var blocked = false;
            for (var attempt = 0; attempt < 150 && !cleanup.IsCompleted; attempt++)
            {
                blocked = await db.Database.SqlQuery<bool>($"SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE pid={pid} AND wait_event_type='Lock') AS \"Value\"").SingleAsync();
                if (blocked) break; await Task.Delay(20);
            }
            Require(blocked, "Housekeeping did not serialize with an in-flight Site preservation decision.");
            await writer.CommitAsync(); await cleanup;
            Require(await maintenance.FederationOutboundMessages.AnyAsync(m => m.MessageId == racing.MessageId), "Concurrent committed hold lost evidence.");
        }
        for (var i = 0; i < PortableExportPackage.MaximumEntries; i++)
        {
            var imageOwner = new Person(Guid.NewGuid(), "Synthetic bounded attachment owner " + i, now);
            imageOwner.SetProfileImage([137,80,78,71], "image/png"); db.People.Add(imageOwner);
            db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), site.Id, imageOwner.Id, now));
        }
        await db.SaveChangesAsync();
        var beforeLimitAudits = await db.AuditEvents.CountAsync(); var beforeLimitReceipts = await db.ExportReceipts.CountAsync();
        try { await PortableExportPackage.Create(site.Id, author.Id, db, default); throw new Exception("Export exceeded the validator's file count limit."); } catch (PortablePackageTooLargeException) { }
        await db.SaveChangesAsync();
        Require(await db.AuditEvents.CountAsync() == beforeLimitAudits && await db.ExportReceipts.CountAsync() == beforeLimitReceipts, "Entry-limit failure created success evidence.");
        Console.WriteLine("Preservation tests passed: concurrent repeatable-read snapshot, historical actor closure, foreign isolation, artifact digest/version acknowledgement, failed export rollback, configurable metadata without scheduling, held transport retention and independent audit preservation.");
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    private static void Reject(Action action) { try { action(); } catch (InvalidOperationException) { return; } throw new Exception("Unsafe receipt operation accepted."); }
    private sealed class ConcurrentChange(string connection, Guid site, Guid work) : DbCommandInterceptor
    {
        internal bool Fired { get; private set; }
        public override async ValueTask<InterceptionResult<DbDataReader>> ReaderExecutingAsync(DbCommand command, CommandEventData eventData, InterceptionResult<DbDataReader> result, CancellationToken ct = default)
        {
            if (!Fired && command.CommandText.Contains("FROM work_items", StringComparison.Ordinal))
            {
                Fired = true;
                await using var other = new Npgsql.NpgsqlConnection(connection); await other.OpenAsync(ct);
                await using var tx = await other.BeginTransactionAsync(ct);
                await using var update = other.CreateCommand(); update.Transaction = tx;
                update.CommandText = "SELECT set_config('fylkren.activity_writer','1',true); UPDATE sites SET name='AFTER_SNAPSHOT_SITE' WHERE id=@site; UPDATE work_items SET title='AFTER_SNAPSHOT_WORK' WHERE id=@work";
                update.Parameters.AddWithValue("site", site); update.Parameters.AddWithValue("work", work);
                await update.ExecuteNonQueryAsync(ct); await tx.CommitAsync(ct);
            }
            return result;
        }
    }
}
