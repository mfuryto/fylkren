using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Approvals;
using Fylkren.Api.Federation;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemStatusEndpoints
{
    private static readonly string[] Statuses = ["registered", "under_review", "on_hold", "rejected", "planning", "execution", "assigned", "in_progress", "in_review", "completed", "reassigned", "request_cancelled"];
    private static readonly string[] Priorities = ["low", "normal", "high", "critical"];

    internal static void Map(RouteGroupBuilder group) =>
        group.MapPut("/sites/{siteId:guid}/items/{itemId:guid}/status", ChangeStatus);

    private static async Task<IResult> ChangeStatus(Guid siteId, Guid itemId, StatusRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, FylkrenOptions options, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        if (!Statuses.Contains(request.Status)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["status"] = ["Invalid task status."] });
        var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
        if (item is null) return Results.NotFound();
        var outgoingRequest = await IsOutgoingRequest(item.Id, siteId, db, ct);
        var now = DateTimeOffset.UtcNow;
        var activityPreviousStatus = item.Status;
        var manager = await CanManageItem(item, personId, db, ct);
        var assigned = item.AssignedUnitId is { } assignedUnitId && await db.RoleAssignments.AnyAsync(x => x.Role.OrganizationUnitId == assignedUnitId && x.PersonId == personId && x.IsActive && x.ValidFrom <= now && (x.ValidTo == null || x.ValidTo > now), ct);
        if (!manager && !assigned) return Results.Problem(statusCode: 403);

        if (request.Status is not ("cancelled" or "rejected" or "on_hold") &&
            request.Status != item.Status &&
            await WorkItemDependencyEndpoints.IsBlocked(item.Id, db, ct))
            return Results.Conflict(new { error = "The task is blocked until all tasks it depends on are completed." });

        if (outgoingRequest)
        {
            var federated = await db.FederationWorkLinks.AsNoTracking().SingleOrDefaultAsync(link =>
                link.Direction == "outgoing" && link.LocalWorkItemId == item.Id &&
                link.OriginSiteId == siteId, ct);
            if (federated is not null)
            {
                if (!manager || request.Status != "completed" ||
                    federated.OfficialAnswerMessageId is null ||
                    federated.OfficialAnswerApprovedAt is null ||
                    string.IsNullOrWhiteSpace(federated.OfficialAnswerSiteName) ||
                    string.IsNullOrWhiteSpace(federated.OfficialAnswer) ||
                    item.Status is "completed" or "cancelled" || item.FinalReportApprovedAt is not null)
                    return Results.Conflict(new { error = "A manager can complete the request after the recipient has delivered an approved official response." });
                item.AcceptFederatedOfficialReport(federated.OfficialAnswer,
                    federated.OfficialAnswerClassification,
                    federated.OfficialAnswerApprovedAt.Value, personId, now);
                await FormalApprovalService.Approve(db, siteId, "final_report", item.Id, item.Id,
                    $"Response to request: {item.Title}", new
                    {
                        task = new { item.Id, item.ReferenceCode, item.OriginReference, item.Title, item.Description, item.AssignedUnitId,
                            item.CreatedAt, item.DueAt },
                        report = new { content = item.FinalReport,
                            classification = item.FinalReportClassification,
                            sourceInstanceId = federated.PeerInstanceId,
                            sourceSiteId = federated.RemoteSiteId,
                            sourceSiteName = federated.OfficialAnswerSiteName,
                            sourceWorkItemId = federated.RemoteWorkItemId,
                            sourceMessageId = federated.OfficialAnswerMessageId,
                            remoteApprovedAt = federated.OfficialAnswerApprovedAt,
                            acceptedAt = now }
                    }, personId, now, ct);
                Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId,
                    "work-item.federated-answer-accepted", "work-item", item.Id, now), "assignment.completed", null);
                DomainEventRecorder.Record(db, "task.completed", siteId, personId,
                    "task", item.Id, new { taskId = item.Id, status = "completed" }, now);
                await db.SaveChangesAsync(ct);
                return Results.NoContent();
            }
            var response = await db.WorkItems.SingleOrDefaultAsync(child => child.ParentWorkItemId == item.Id && child.SenderSiteName != null && (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId) && (child.Status == "completed" || child.Status == "rejected" || child.Status == "cancelled"), ct);
            if (!manager || request.Status != "completed" || response is null) return Results.Conflict(new { error = "A manager can complete the request after the recipient has responded to or closed it." });
            if (response.Status == "completed")
            {
                if (string.IsNullOrWhiteSpace(response.FinalReport) || response.FinalReportApprovedAt is null) return Results.Conflict(new { error = "The receiving site has not delivered an approved official response." });
                item.CarryForwardFinalReport(response, now);
                item.ApproveFinalReport(personId, now);
                await FormalApprovalService.Approve(db, siteId, "final_report", item.Id, item.Id, $"Response to request: {item.Title}", new
                {
                    task = new { item.Id, item.ReferenceCode, item.OriginReference, item.Title, item.Description, item.AssignedUnitId, item.CreatedAt, item.DueAt },
                    report = new { content = item.FinalReport, classification = item.FinalReportClassification, sourceWorkItemId = response.Id, sourceSiteId = response.SiteId, writtenAt = item.FinalReportUpdatedAt }
                }, personId, now, ct);
            }
            item.TransitionWithinLevel("completed", "The request was closed by the sender.", now);
            Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.request-closed", "work-item", item.Id, now), "assignment.completed", null);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }
        if (item.Status == "request_cancelled")
        {
            if (!manager || request.Status != "completed") return Results.Conflict(new { error = "A withdrawn request can only be acknowledged as completed by the receiving manager." });
            item.TransitionWithinLevel("completed", item.DecisionNote, now);
            Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.request-cancellation-acknowledged", "work-item", item.Id, now), "assignment.cancelled", null);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }
        if (!ValidTransition(item.Status, request.Status, manager)) return Results.Conflict(new { error = "The status transition is not allowed." });
        if (item.Status == "registered" && request.Status == "under_review" && (request.Priority is null || !Priorities.Contains(request.Priority))) return Results.ValidationProblem(new Dictionary<string, string[]> { ["priority"] = ["The manager must select a priority when the task enters review."] });
        if (item.Status == "in_review" && request.Status == "in_progress" && item.FinalReportApprovedAt is not null) return Results.Conflict(new { error = "An approved final report cannot be returned. Complete the task, or edit the report to revoke approval first." });
        if (request.Status == "in_review")
        {
            var directChildren = await db.WorkItems.Where(x => x.ParentWorkItemId == item.Id).Select(x => x.Status).ToListAsync(ct);
            if (directChildren.Count == 0) return Results.Conflict(new { error = "Tasks that are not routed further must pass through Execution before they can be submitted for review." });
            if (directChildren.Any(status => status is not ("completed" or "reassigned"))) return Results.Conflict(new { error = "All direct subtasks must be completed before the task can be submitted for review." });
        }
        if (request.Status == "completed" && string.IsNullOrWhiteSpace(item.FinalReport)) return Results.Conflict(new { error = "The final report must be saved before the task can be completed." });
        if (request.Status == "completed" && item.FinalReportApprovedAt is null) return Results.Conflict(new { error = "The final report must be approved before the task can be completed." });
        OrganizationUnit? requestedAssignment = null;
        if (request.Status == "assigned")
        {
            if (request.AssignedUnitId is not { } requestedUnit || !await IsDirectChild(siteId, item.AssignedUnitId, requestedUnit, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["assignedUnitId"] = ["Select an active direct subordinate unit."] });
            requestedAssignment = await db.OrganizationUnits.SingleAsync(x => x.Id == requestedUnit, ct);
        }
        if (request.Status is "on_hold" or "rejected" && string.IsNullOrWhiteSpace(request.DecisionNote)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["decisionNote"] = ["A rationale is required."] });
        WorkflowDefinition? planningDefinition = null;
        if (request.Status == "planning")
        {
            planningDefinition = await db.WorkflowDefinitions.FirstOrDefaultAsync(x => x.SiteId == siteId && x.Kind == "planning" && x.IsActive, ct);
            if (planningDefinition is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["planningWorkflow"] = ["A Site Manager must configure the planning workflow before tasks can be sent to planning."] });
        }
        if (request.Status == "execution")
        {
            var workflowOwnerUnitId = item.AssignedUnitId ?? await db.OrganizationUnits.Where(x => x.SiteId == siteId && x.IsActive && x.IsSiteLeadership).Select(x => (Guid?)x.Id).SingleOrDefaultAsync(ct);
            if (!await db.WorkflowDefinitions.AnyAsync(x => x.SiteId == siteId && x.Kind == "execution" && x.IsActive && (x.OwnerUnitId == null || x.OwnerUnitId == workflowOwnerUnitId), ct))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["executionWorkflow"] = ["There must be at least one active execution workflow for this level."] });
        }
        if (item.Status == "registered" && request.Status == "under_review") item.SetPriority(request.Priority!, now);
        var decisionNote = (item.Status is "rejected" or "on_hold") && request.Status == "under_review" && string.IsNullOrWhiteSpace(request.DecisionNote) ? item.DecisionNote : request.DecisionNote;
        var resumedPlan = item.Status == "on_hold" && request.Status == "under_review" && await db.WorkflowRuns.AnyAsync(x => x.WorkItemId == item.Id && x.Status == "awaiting_approval", ct);
        var resumedApprovedPlan = item.Status == "on_hold" && request.Status == "under_review" && await db.WorkflowRuns.AnyAsync(x => x.WorkItemId == item.Id && x.Status == "approved", ct);
        var returnedExecution = item.Status == "in_review" && request.Status == "in_progress" ? await db.ExecutionRuns.SingleOrDefaultAsync(x => x.WorkItemId == item.Id && x.Status == "submitted", ct) : null;
        if (returnedExecution is not null) returnedExecution.Return(now);
        var nextStatus = returnedExecution is not null ? "execution" : resumedPlan ? "planning_approval" : resumedApprovedPlan ? "planning_approved" : request.Status;
        if (requestedAssignment is not null)
        {
            WorkItem child;
            if (requestedAssignment.SiteId == siteId)
            {
                child = WorkItem.CreateDelegated(Guid.NewGuid(), item, personId, requestedAssignment.Id, requestedAssignment.Name, item.Description, now);
            }
            else
            {
                var source = await db.Sites.SingleAsync(x => x.Id == siteId, ct);
                var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
                var sourceTypeName = item.SourceTypeId is Guid sourceTypeId ? await db.WorkItemLookups.Where(x => x.Id == sourceTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : item.SourceTypeNameSnapshot;
                var workItemTypeName = item.WorkItemTypeId is Guid workItemTypeId ? await db.WorkItemTypes.Where(x => x.Id == workItemTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : item.WorkItemTypeNameSnapshot;
                var senderName = item.SenderId is Guid senderId ? await db.WorkItemLookups.Where(x => x.Id == senderId).Select(x => x.Name).SingleOrDefaultAsync(ct) : item.SenderNameSnapshot;
                child = WorkItem.CreateTransferred(Guid.NewGuid(), item, requestedAssignment.SiteId, personId, source.Name, actor.DisplayName, sourceTypeName, workItemTypeName, senderName, item.UpstreamPlanWorkItemId, item.Description, now);
                Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), requestedAssignment.SiteId, personId, "work-item.received-from-parent-site", "work-item", child.Id, now), "assignment.received", "new-work-item", originSiteId: siteId);
            }
            db.WorkItems.Add(child);
            DomainEventRecorder.Record(db, "assignment.created", child.SiteId, child.SiteId == siteId ? personId : null, "task", child.Id, new { taskId = child.Id, parentTaskId = child.SiteId == siteId ? item.Id : (Guid?)null, assignedUnitId = child.AssignedUnitId }, now);
            item.TransitionWithinLevel("in_progress", decisionNote, now);
            Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, requestedAssignment.SiteId == siteId ? "work-item.delegated" : "work-item.transferred-to-child-site", "work-item", child.Id, now), "assignment.created", "new-work-item", originSiteId: siteId);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, "assignment.sent", "work-item", item.Id, now), "assignment.sent");
        }
        else
        {
            item.TransitionWithinLevel(nextStatus, decisionNote, now);
        }
        if (planningDefinition is not null && !await db.WorkflowRuns.AnyAsync(x => x.WorkItemId == item.Id, ct))
        {
            var run = new WorkflowRun(Guid.NewGuid(), item.Id, planningDefinition.Id);
            if (await db.WorkflowSteps.AnyAsync(x => x.DefinitionId == planningDefinition.Id && x.HasTimeline, ct))
                run.InitializeTimeline(DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(now, TimeZoneInfo.FindSystemTimeZoneById(options.Localization.TimeZone)).DateTime));
            db.WorkflowRuns.Add(run);
            var initialDocuments = await db.WorkflowSteps.AsNoTracking().Where(x => x.DefinitionId == planningDefinition.Id && x.TemplateId != null && x.Template != null).Select(x => new { x.Id, Content = x.Template!.Content }).ToListAsync(ct);
            foreach (var document in initialDocuments) db.WorkflowStepDocuments.Add(new WorkflowStepDocument(Guid.NewGuid(), run.Id, document.Id, document.Content, now));
        }
        Fylkren.Api.DomainEvents.WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, $"work-item.{request.Status}", "work-item", item.Id, now), request.Status == "completed" ? "assignment.completed" : request.Status is "in_progress" or "execution" ? "assignment.started" : activityPreviousStatus == "registered" && request.Status == "under_review" ? "assignment.accepted" : activityPreviousStatus is "rejected" or "on_hold" && request.Status == "under_review" ? "assignment.reopened" : "assignment.updated", request.Status == "completed" ? "child-work-completed" : request.Status is "assigned" or "under_review" or "in_progress" or "planning" or "execution" or "on_hold" or "rejected" ? "work-item-changed" : null);
        string? federationError;
        if (request.Status == "completed")
        {
            DomainEventRecorder.Record(db, "task.completed", siteId, personId, "task", item.Id,
                new { taskId = item.Id, status = "completed" }, now);
            federationError = await FederationOperationalReturnQueue.QueueAnswerIfFederatedAsync(
                item, personId, now, db, ct);
        }
        else
        {
            federationError = await FederationOperationalReturnQueue.QueueProgressIfFederatedAsync(
                item, personId, now, db, ct);
        }
        if (federationError is not null)
            return Results.Conflict(new { error = federationError });
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static bool ValidTransition(string current, string next, bool manager) => current == next || (current, next) switch
    {
        ("registered", "under_review") => manager,
        ("under_review", "on_hold" or "rejected" or "planning" or "execution" or "assigned") => manager,
        ("on_hold", "under_review") => manager,
        ("rejected", "under_review") => manager,
        ("assigned", "planning" or "execution") => manager,
        ("planning_approved", "on_hold") => manager,
        ("in_progress", "on_hold" or "execution" or "in_review") => manager,
        ("in_review", "completed" or "in_progress") => manager,
        _ => false
    };
}
