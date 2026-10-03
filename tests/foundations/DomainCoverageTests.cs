using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Decisions;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.Risks;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

internal static class DomainCoverageTests
{
    internal static async Task Run(FylkrenDbContext db)
    {
        db.ChangeTracker.Clear();
        var now = DateTimeOffset.UtcNow;
        var site = await db.Sites.Where(x => x.Name == "Synthetic foundation site").Select(x => x.Id).SingleAsync();
        var person = Guid.NewGuid();
        db.People.Add(new Person(person, "Synthetic domain author", now));
        db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), site, person, now));
        var item = new WorkItem(Guid.NewGuid(), site, person, "Synthetic domain context", "", null, "normal", null, now);
        db.WorkItems.Add(item);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), site, person, "work-item.registered", "work-item", item.Id, now), "task.created");
        await db.SaveChangesAsync();

        var decision = new Decision(Guid.NewGuid(), site, person, now);
        db.Decisions.Add(decision);
        var decisionAudit = new AuditEvent(Guid.NewGuid(), site, person, "decision.created", "decision", decision.Id, now);
        WorkActivity.Add(db, decisionAudit, "decision.created", workItemId: item.Id, resourceType: "decision", metadataJson: "{\"revision\":1,\"status\":\"draft\"}");
        var legacy = DomainEventRecorder.Record(db, "decision.recorded", site, person, "decision", decision.Id, new { taskId = item.Id, revision = 1, status = "draft" }, now);
        await db.SaveChangesAsync();
        var decisionFact = await db.DomainEvents.AsNoTracking().SingleAsync(x => x.ResourceId == decision.Id);
        Require(decisionFact.Id == legacy.Id && decisionFact.EventType == "decision.recorded" && decisionFact.ActivityType == "decision.created" && decisionFact.ActorPersonId == person, "Decision v1 contract/actor was replaced or duplicated.");
        Require(System.Text.Json.Nodes.JsonNode.DeepEquals(System.Text.Json.Nodes.JsonNode.Parse(decisionFact.PayloadJson), System.Text.Json.Nodes.JsonNode.Parse(legacy.PayloadJson)), "Decision v1 payload was changed.");
        Require(decisionAudit.DomainEventId == decisionFact.Id && decisionFact.ContextWorkItemId == item.Id, "Decision context/audit correlation was lost.");

        // A report and a private learning effect can coexist without consuming each other's v1 event.
        var lessonId = Guid.NewGuid();
        var learningAudit = new AuditEvent(Guid.NewGuid(), site, person, "learning.created", "work-item", item.Id, now);
        WorkActivity.Add(db, learningAudit, "learning.created", resourceType: "learning", resourceId: lessonId, metadataJson: "{}");
        var reportAudit = new AuditEvent(Guid.NewGuid(), site, person, "work-item.completed", "work-item", item.Id, now);
        WorkActivity.Add(db, reportAudit, "assignment.completed");
        var oldReport = DomainEventRecorder.Record(db, "task.completed", site, person, "task", item.Id, new { taskId = item.Id }, now);
        await db.SaveChangesAsync();
        var learning = await db.DomainEvents.AsNoTracking().SingleAsync(x => x.Id == learningAudit.DomainEventId);
        var report = await db.DomainEvents.AsNoTracking().SingleAsync(x => x.Id == reportAudit.DomainEventId);
        Require(report.Id == oldReport.Id && report.EventType == "task.completed" && learning.Id != report.Id && learning.ResourceId == lessonId && learning.ResourceType == "learning", "Companion effects consumed or duplicated the report contract.");
        Require(learning.ActivityMetadataJson == "{}" && learning.PayloadJson == "{}", "Private learning content was copied to activity.");
        Require(await db.EventProjections.CountAsync(x => x.DomainEventId == learning.Id && x.Status == "skipped") == 2, "Private learning unexpectedly scheduled external delivery.");

        var risk = new Risk(Guid.NewGuid(), site, "task", item.Id, person, now);
        var riskAudit = new AuditEvent(Guid.NewGuid(), site, person, "risk.created", "risk", risk.Id, now);
        await using (var transaction = await db.Database.BeginTransactionAsync())
        {
            db.Risks.Add(risk);
            db.RiskRevisions.Add(new RiskRevision(Guid.NewGuid(), risk.Id, 1, "PRIVATE_RISK_SENTINEL", "PRIVATE_RISK_BODY", 4, 5, person, "Synthetic owner", "identified", null, null, null, person, now));
            WorkActivity.Add(db, riskAudit, "risk.created", workItemId: item.Id, resourceType: "risk", metadataJson: "{\"revision\":1,\"status\":\"identified\"}");
            await db.SaveChangesAsync();
            await transaction.RollbackAsync();
        }
        db.ChangeTracker.Clear();
        Require(!await db.Risks.AnyAsync(x => x.Id == risk.Id) && !await db.RiskRevisions.AnyAsync(x => x.RiskId == risk.Id) && !await db.AuditEvents.AnyAsync(x => x.Id == riskAudit.Id) && !await db.DomainEvents.AnyAsync(x => x.ResourceId == risk.Id), "Rollback split risk revision, activity and security audit.");
        Require(!await db.EventProjections.AnyAsync(x => x.DomainEventId == riskAudit.DomainEventId), "Rolled-back risk projection survived.");
        Console.WriteLine("Domain coverage database tests passed: unchanged decision v1 ID/payload/actor, companion learning/report isolation, private metadata without dispatch and risk revision/audit/activity/projection rollback.");
    }
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
}
