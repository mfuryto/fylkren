using Fylkren.Api.Persistence;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemSummaryProjection
{
    internal static IQueryable<WorkItemSummary> Project(
        IQueryable<WorkItem> query,
        Guid siteId,
        Guid personId,
        DateTimeOffset now,
        FylkrenDbContext db) =>
        query
            .OrderBy(item =>
                item.Status == "completed" || item.Status == "rejected" ||
                item.Status == "cancelled" || item.Status == "reassigned")
            .ThenBy(item => item.DueAt)
            .ThenByDescending(item => item.CreatedAt)
            .Select(item => new WorkItemSummary(
                item.Id,
                item.SiteId,
                item.ParentWorkItem != null && item.ParentWorkItem.SiteId != siteId && item.SiteId == siteId ? null : item.ParentWorkItemId,
                item.ParentWorkItem == null ? null : item.ParentWorkItem.Title,
                item.WorkItemTypeId,
                item.WorkItemType == null ? item.WorkItemTypeNameSnapshot : item.WorkItemType.Name,
                item.SourceTypeId,
                item.SourceType == null ? item.SourceTypeNameSnapshot : item.SourceType.Name,
                item.SenderId,
                item.Sender == null ? item.SenderNameSnapshot : item.Sender.Name,
                item.SenderSiteName,
                item.SenderPersonName,
                item.RequestBasisSnapshot,
                item.SiteId != siteId,
                item.Title,
                item.Description,
                item.Recommendation,
                item.ReferenceUrl,
                item.Priority,
                item.Status,
                item.DueAt,
                item.AssignedUnitId,
                item.AssignedUnit == null ? item.SiteId != siteId ? item.Site.Name : null : item.AssignedUnit.Name,
                item.AssignedUnit != null && item.AssignedUnit.Roles.Any(role => role.Assignments.Any(assignment =>
                    assignment.PersonId == personId && assignment.IsActive && assignment.ValidFrom <= now &&
                    (assignment.ValidTo == null || assignment.ValidTo > now))),
                item.WorkflowRun != null || item.UpstreamPlanWorkItemId != null ||
                item.ParentWorkItem != null && item.ParentWorkItem.SiteId == siteId && item.ParentWorkItem.WorkflowRun != null,
                item.WorkflowRun == null ? null : item.WorkflowRun.CurrentStep,
                item.WorkflowRun == null ? 0 : item.WorkflowRun.Definition.Steps.Count,
                item.WorkflowRun == null
                    ? null
                    : item.WorkflowRun.Definition.Steps
                        .Where(step => step.SortOrder == item.WorkflowRun.CurrentStep)
                        .Select(step => step.Name)
                        .FirstOrDefault(),
                item.ExecutionRun == null ? null : item.ExecutionRun.Status,
                item.ExecutionRun == null || item.ExecutionRun.Definition == null ? null : item.ExecutionRun.Definition.Name,
                item.ExecutionRun == null ? null : item.ExecutionRun.CurrentStep,
                item.ExecutionRun == null || item.ExecutionRun.Definition == null ? 0 : item.ExecutionRun.Definition.Steps.Count,
                item.ExecutionRun == null || item.ExecutionRun.Definition == null
                    ? null
                    : item.ExecutionRun.Definition.Steps
                        .Where(step => step.SortOrder == item.ExecutionRun.CurrentStep)
                        .Select(step => step.Name)
                        .FirstOrDefault(),
                item.ExecutionRun == null ? 0 : item.ExecutionRun.ExternalRequests.Count(request => request.Status == "awaiting_response"),
                db.WorkItemDependencies.Count(dependency => dependency.DependentWorkItemId == item.Id),
                db.WorkItemDependencies.Any(dependency => dependency.DependentWorkItemId == item.Id && dependency.PredecessorWorkItem.Status != "completed"),
                db.WorkItemDependencies.Count(dependency => dependency.DependentWorkItemId == item.Id && dependency.PredecessorWorkItem.Status != "completed"),
                db.Decisions.Count(decision => decision.SiteId == item.SiteId && decision.Revisions.Any(revision => revision.References.Any(reference => reference.ObjectType == "work_item" && reference.ObjectId == item.Id))),
                item.DecisionNote,
                item.FinalReport,
                item.FinalReportClassification,
                item.FinalReportCreatedAt,
                item.FinalReportUpdatedAt,
                item.FinalReportWrittenByPerson == null ? null : item.FinalReportWrittenByPerson.DisplayName,
                item.FinalReportApprovedAt,
                item.FinalReportApprovedByPerson == null ? null : item.FinalReportApprovedByPerson.DisplayName,
                item.CreatedByPerson == null ? item.SenderSiteName ?? "Ekstern site" : item.CreatedByPerson.DisplayName,
                item.CreatedAt,
                item.UpdatedAt,
                item.WorkItemType != null && item.WorkItemType.IsSystemManaged &&
                item.WorkItemType.NormalizedName == "ANMODNING" && (db.WorkItems.Any(child =>
                    child.ParentWorkItemId == item.Id && child.SenderSiteName != null &&
                    (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId)) ||
                    db.FederationWorkLinks.Any(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing")),
                db.FederationWorkLinks
                    .Where(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing")
                    .Join(db.FederationRemoteSites,
                        link => new { InstanceId = link.PeerInstanceId, SiteId = link.RemoteSiteId },
                        remote => new { remote.InstanceId, remote.SiteId },
                        (link, remote) => remote.Name)
                    .FirstOrDefault() ?? db.WorkItems
                    .Where(child =>
                        child.ParentWorkItemId == item.Id && child.SenderSiteName != null &&
                        (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId))
                    .Select(child => child.SiteId == item.SiteId ? child.AssignedUnit!.Name : child.Site.Name)
                    .FirstOrDefault(),
                db.FederationWorkLinks.Any(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing") ||
                    db.WorkItems.Any(child =>
                        child.ParentWorkItemId == item.Id && child.SenderSiteName != null && child.SiteId != item.SiteId),
                item.Status == "cancelled"
                    ? "cancelled"
                    : db.FederationWorkLinks
                        .Where(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing")
                        .Select(link => link.RemoteProgressStatus ??
                            (link.AcknowledgedAt == null ? "pending_delivery" : "received"))
                        .FirstOrDefault() ?? db.WorkItems
                        .Where(child =>
                            child.ParentWorkItemId == item.Id && child.SenderSiteName != null &&
                            (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId))
                        .Select(child => child.Status)
                        .FirstOrDefault(),
                db.FederationWorkLinks
                    .Where(link => link.LocalWorkItemId == item.Id && link.Direction == "outgoing")
                    .Select(link => link.OfficialAnswer)
                    .FirstOrDefault() ?? db.WorkItems
                    .Where(child =>
                        child.ParentWorkItemId == item.Id && child.SenderSiteName != null &&
                        (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId))
                    .Where(child => child.Status == "completed" && child.FinalReportApprovedAt != null)
                    .Select(child => child.FinalReport)
                    .FirstOrDefault()));
}
