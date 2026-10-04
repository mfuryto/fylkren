using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal static class WorkLifecyclePolicy
{
    internal static bool Terminal(string status) => status is "completed" or "cancelled" or "rejected" or "reassigned";
    internal static async Task<Dictionary<string, long>> Blockers(WorkItem item, FylkrenDbContext db, bool archive, CancellationToken ct)
    {
        var reasons = new Dictionary<string, long>();
        void Add(string key, long count) { if (count > 0) reasons[key] = count; }
        if (!Terminal(item.Status)) { Add("unfinished_work", 1); return reasons; }
        var descendants = await db.WorkItems.FromSqlInterpolated($"WITH RECURSIVE tree AS (SELECT id FROM work_items WHERE id = {item.Id} UNION SELECT w.id FROM work_items w JOIN tree t ON w.parent_work_item_id = t.id WHERE w.site_id = {item.SiteId}) SELECT w.*, w.xmin FROM work_items w JOIN tree t ON w.id = t.id").AsNoTracking().ToListAsync(ct);
        var ids = descendants.Select(x => x.Id).ToArray();
        // Acknowledged withdrawals and closed unanswered requests legitimately end
        // without a final report. Apply this rule to every owned descendant.
        var withdrawals = await db.DomainEvents.Where(e => e.ContextWorkItemId != null && ids.Contains(e.ContextWorkItemId.Value) && e.ActivityType == "assignment.cancelled").Select(e => e.ContextWorkItemId!.Value).ToArrayAsync(ct);
        var closedRequests = await db.WorkItems.Where(child => child.ParentWorkItemId != null && ids.Contains(child.ParentWorkItemId.Value) && child.SenderSiteName != null &&
            (child.SiteId != child.ParentWorkItem!.SiteId || child.AssignedUnitId != child.ParentWorkItem.AssignedUnitId) && (child.Status == "rejected" || child.Status == "cancelled")).Select(child => child.ParentWorkItemId!.Value).ToArrayAsync(ct);
        Add("final_report", descendants.LongCount(x => x.Status == "completed" && x.FinalReportApprovedAt is null && !withdrawals.Contains(x.Id) && !closedRequests.Contains(x.Id)));
        var ancestors = await db.Database.SqlQuery<Guid>($$"""
            WITH RECURSIVE chain AS (SELECT id,parent_work_item_id,site_id FROM work_items WHERE id={{item.Id}}
              UNION SELECT w.id,w.parent_work_item_id,w.site_id FROM work_items w JOIN chain c ON w.id=c.parent_work_item_id AND w.site_id=c.site_id)
            SELECT id AS "Value" FROM chain
            """).ToArrayAsync(ct);
        Add("inherited_preservation", await db.InformationLifecycles.LongCountAsync(l => l.OwnerSiteId == item.SiteId && l.IsHeld && (l.ResourceType == "site" || l.ResourceType == "work_item" && l.ResourceId != item.Id && ancestors.Contains(l.ResourceId)), ct));
        Add("retired_site", await db.InformationLifecycles.LongCountAsync(l => l.OwnerSiteId == item.SiteId && l.ResourceType == "site" && l.Stage != "active", ct));
        Add("unfinished_work", descendants.LongCount(x => !Terminal(x.Status)));
        Add("preservation", await db.InformationLifecycles.LongCountAsync(l => l.ResourceType == "work_item" && ids.Contains(l.ResourceId) && l.IsHeld, ct));
        Add("editing", await db.InformationLifecycles.LongCountAsync(l => l.ResourceType == "work_item" && l.ResourceId != item.Id && ids.Contains(l.ResourceId) && l.AutomationPaused && (archive || l.Stage == "active"), ct));
        Add("open_plans", await db.WorkflowRuns.LongCountAsync(x => ids.Contains(x.WorkItemId) && x.Status != "approved" && x.Status != "rejected" && x.Status != "cancelled", ct));
        Add("open_execution", await db.ExecutionRuns.LongCountAsync(x => ids.Contains(x.WorkItemId) && x.Status != "submitted" && x.Status != "cancelled", ct));
        Add("open_risks", await db.Risks.LongCountAsync(x => (ids.Contains(x.ObjectId) && (x.ObjectType == "task" || x.ObjectType == "assignment") ||
            x.ObjectType == "plan" && db.WorkflowRuns.Any(r => r.Id == x.ObjectId && ids.Contains(r.WorkItemId)) ||
            x.ObjectType == "execution" && db.ExecutionRuns.Any(r => r.Id == x.ObjectId && ids.Contains(r.WorkItemId))) &&
            x.Revisions.OrderByDescending(r => r.Version).Select(r => r.Status).FirstOrDefault() != "closed", ct));
        // Learning has its own ongoing treatment lifecycle. Original observations
        // remain immutable after closure; authorized review/comments can continue.
        if (!archive) return reasons;
        Add("pending_notifications", await db.NotificationOutboxMessages.LongCountAsync(x => ids.Contains(x.WorkItemId) && x.Status == "pending", ct));
        Add("pending_projection", await db.EventProjections.LongCountAsync(x => x.Status != "completed" && x.Status != "skipped" && db.DomainEvents.Any(e => e.Id == x.DomainEventId && e.ContextWorkItemId != null && ids.Contains(e.ContextWorkItemId.Value)), ct));
        Add("pending_webhooks", await db.WebhookDeliveries.LongCountAsync(x => x.Status != "succeeded" && x.Status != "failed" && x.DomainEvent.ContextWorkItemId != null && ids.Contains(x.DomainEvent.ContextWorkItemId.Value), ct));
        Add("pending_federation", await db.FederationOutboundMessages.LongCountAsync(x => (ids.Contains(x.OriginResourceId) || db.FederationWorkLinks.Any(l => ids.Contains(l.LocalWorkItemId) && l.OriginResourceId == x.OriginResourceId && l.OriginInstanceId == x.OriginInstanceId && l.PeerInstanceId == x.PeerInstanceId)) && (x.Status == "pending" || x.Status == "retrying"), ct));
        var failedNotifications = await db.NotificationOutboxMessages.LongCountAsync(x => ids.Contains(x.WorkItemId) && x.Status == "failed", ct);
        var failedWebhooks = await db.WebhookDeliveries.LongCountAsync(x => x.Status == "failed" && x.DomainEvent.ContextWorkItemId != null && ids.Contains(x.DomainEvent.ContextWorkItemId.Value), ct);
        var failedFederation = await db.FederationOutboundMessages.LongCountAsync(x => (ids.Contains(x.OriginResourceId) || db.FederationWorkLinks.Any(l => ids.Contains(l.LocalWorkItemId) && l.OriginResourceId == x.OriginResourceId && l.OriginInstanceId == x.OriginInstanceId && l.PeerInstanceId == x.PeerInstanceId)) && x.Status == "failed", ct);
        Add("failed_deliveries", NumericBounds.AddCount(NumericBounds.AddCount(failedNotifications, failedWebhooks), failedFederation));
        return reasons;
    }
}
