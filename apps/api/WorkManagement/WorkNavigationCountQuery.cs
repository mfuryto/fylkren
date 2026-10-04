using Fylkren.Api.Persistence;

namespace Fylkren.Api.WorkManagement;

internal static class WorkNavigationCountQuery
{
    // Same pending-decision predicates as the card projection, without its
    // report bodies, labels, workflow details or ordering. Keep the differential
    // PostgreSQL coverage when changing WorkItemSummaryProjection semantics.
    internal static IQueryable<WorkItem> Tasks(IQueryable<WorkItem> items, Guid?[] ledLevels, FylkrenDbContext db) =>
        items.Where(item => ledLevels.Contains(item.AssignedUnitId) &&
            (item.Status == "registered" || item.Status == "under_review" ||
             item.Status == "planning_approval" || item.Status == "planning_approved" ||
             item.Status == "in_review" || item.Status == "request_cancelled" ||
             ((item.Status == "assigned" || item.Status == "in_progress") &&
              !db.WorkItems.Any(child => child.ParentWorkItemId == item.Id &&
                  child.Status != "completed" && child.Status != "rejected" &&
                  child.Status != "cancelled" && child.Status != "reassigned"))))
        .Where(item => !db.WorkItemDependencies.Any(dependency => dependency.DependentWorkItemId == item.Id && dependency.PredecessorWorkItem.Status != "completed"))
        .Where(item => item.WorkItemType == null || !item.WorkItemType.IsSystemManaged ||
            !(db.WorkItems.Any(child => child.ParentWorkItemId == item.Id && child.SenderSiteName != null &&
                (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId)) ||
              db.FederationWorkLinks.Any(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing")) ||
            new[] { "completed", "rejected", "cancelled" }.Contains(
                db.FederationWorkLinks.Where(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing")
                    .Select(link => link.RemoteProgressStatus ?? (link.AcknowledgedAt == null ? "pending_delivery" : "received")).FirstOrDefault()
                ?? db.WorkItems.Where(child => child.ParentWorkItemId == item.Id && child.SenderSiteName != null &&
                        (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId))
                    .Select(child => child.Status).FirstOrDefault()));
}
