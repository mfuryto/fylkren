using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Identity;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

internal static class GovernanceTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        db.ChangeTracker.Clear(); await db.Database.MigrateAsync();
        var now = DateTimeOffset.UtcNow;
        var site = new Site(Guid.NewGuid(), "Synthetic governance archive", now); site.Update(site.Name, null, false);
        var other = new Site(Guid.NewGuid(), "Synthetic governance independent owner", now);
        var actor = new Person(Guid.NewGuid(), "Synthetic archive custodian", now);
        var inactive = new Person(Guid.NewGuid(), "Synthetic preserved author", now); inactive.Update(inactive.DisplayName, false);
        db.Sites.AddRange(site, other); db.People.AddRange(actor, inactive);
        db.LoginIdentities.Add(new LoginIdentity(Guid.NewGuid(), actor.Id, "synthetic-custodian", false, now));
        db.ArchiveGrants.Add(new ArchiveGrant(Guid.NewGuid(), site.Id, actor.Id, true, now)); await db.SaveChangesAsync();
        Require(!await ArchiveAccess.CanRead(site.Id, actor.Id, db, default), "Archive access activated while the root was active.");
        var impact = await LifecycleImpactQuery.Site(site.Id, db, default); Require(impact.Eligible, "Empty inactive Site with a custodian could not close.");
        var root = new InformationLifecycleRecord(Guid.NewGuid(), site.Id, "site", site.Id, null, now);
        root.Transition("closed", 1, "Finished local work", now); db.InformationLifecycles.Add(root);
        var audit = new AuditEvent(Guid.NewGuid(), site.Id, actor.Id, "information.closed", "site", site.Id, now);
        await DomainEventRecorder.RecordGovernance(db, audit, "information.closed", site.Id, "site", site.Id, new { status = "closed" }, default);
        await db.SaveChangesAsync();
        Require(await ArchiveAccess.CanRead(site.Id, actor.Id, db, default) && await IdentityEndpoints.HasActiveAccess(actor.Id, db, default), "Explicit custodian eligibility was not established.");
        Require(await db.EventProjections.CountAsync(p => p.DomainEventId == audit.DomainEventId && p.Status == "skipped") == 2, "Administrative activity scheduled an external delivery.");
        await RejectSql(db, () => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE sites SET name = 'Forbidden archive rename' WHERE id = {site.Id}"), "site_lifecycle_guard");
        await RejectSql(db, () => db.Database.ExecuteSqlInterpolatedAsync($"INSERT INTO organization_units(id,site_id,name,normalized_name,is_temporary,is_active,is_site_root,is_site_leadership,works_at_parent_level,created_at) VALUES({Guid.NewGuid()},{site.Id},'Forbidden','FORBIDDEN',false,true,false,false,false,{now})"), "site_lifecycle_guard");
        actor.Update("Shared identity retained independently", true); other.Update("Governance independent Site can still change", null, true); await db.SaveChangesAsync();
        Require(await db.Sites.AnyAsync(s => s.Id == other.Id && s.Name == "Governance independent Site can still change"), "Archive froze another owner's data.");
        var personRoot = new InformationLifecycleRecord(Guid.NewGuid(), null, "person", inactive.Id, null, now); personRoot.Transition("closed", 1, "Disabled identity retained", now); db.InformationLifecycles.Add(personRoot); await db.SaveChangesAsync();
        await RejectSql(db, () => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE people SET display_name = 'Forbidden attribution change' WHERE id = {inactive.Id}"), "person_lifecycle_guard");
        var policy = new RetentionPolicyVersion(Guid.NewGuid(), 1, "Explicit review only", "content", null, actor.Id, now); db.RetentionPolicyVersions.Add(policy); await db.SaveChangesAsync();
        root.BindPolicy(policy.PolicyId, policy.Version, root.Version, "Bind review policy without disposal", now); await db.SaveChangesAsync();
        Require(root.EligibleAt is null && root.Stage == "closed", "Binding policy enabled retention or invented a duration.");
        await RejectSql(db, () => db.Database.ExecuteSqlInterpolatedAsync($"UPDATE retention_policy_versions SET name = 'Mutated policy' WHERE policy_id = {policy.PolicyId}"), "retention_policy_immutable");
        var hold = new LifecycleHold(Guid.NewGuid(), root.Id, actor.Id, "Preserve evidence", now); db.LifecycleHolds.Add(hold); root.SetHold(true, root.Version, hold.Reason, now); await db.SaveChangesAsync();
        try { root.Transition("archived", root.Version, "Held transition", now); throw new Exception("Held archive was accepted."); } catch (InvalidOperationException) { }
        hold.Release(actor.Id, "Review finished", now); root.SetHold(false, root.Version, "Review finished", now); root.Transition("archived", root.Version, "Preserve information", now); await db.SaveChangesAsync();
        var grant = await db.ArchiveGrants.SingleAsync(g => g.SiteId == site.Id); grant.Revoke(grant.Version, now); await db.SaveChangesAsync();
        Require(!await ArchiveAccess.CanRead(site.Id, actor.Id, db, default) && !await IdentityEndpoints.HasActiveAccess(actor.Id, db, default), "Revocation retained archive/session eligibility.");
        root.Transition("closed", root.Version, "Restore preserved archive", now); root.Transition("active", root.Version, "Reopen content", now); await db.SaveChangesAsync();
        site.Update("Reopened Site content", null, false); await db.SaveChangesAsync();
        Require(await db.AuditEvents.AnyAsync(a => a.Id == audit.Id) && await db.DomainEvents.AnyAsync(e => e.Id == audit.DomainEventId), "Restore lost immutable history.");
        Console.WriteLine("Governance tests passed: independent Site/person owners, SQL archive guards, explicit custodian authentication/revocation, shared recorder, immutable review policy without execution, holds and restoration.");
    }
    private static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
    private static async Task RejectSql(FylkrenDbContext db, Func<Task<int>> action, string constraint)
    {
        try { await action(); } catch (Npgsql.PostgresException e) when (e.ConstraintName == constraint) { return; }
        throw new Exception($"Expected SQL archive guard {constraint}.");
    }
}
