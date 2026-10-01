using System.Text;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Approvals;
using Fylkren.Api.Federation;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningApprovalService
{
    internal static async Task Approve(WorkflowRun run, Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        if (run.ProposedPriority is null) throw new InvalidOperationException("The proposed plan is incomplete.");
        var now = DateTimeOffset.UtcNow;
        var allocations = await db.WorkflowPlanAllocations.Include(x => x.Step).Include(x => x.Unit).Where(x => x.RunId == run.Id).OrderBy(x => x.Step.SortOrder).ThenBy(x => x.Unit.Name).ToListAsync(ct);
        var requests = await db.WorkflowPlanRequests.Include(x => x.Step).Include(x => x.TargetSite).Where(x => x.RunId == run.Id).OrderBy(x => x.Step.SortOrder).ThenBy(x => x.TargetSite == null ? x.TargetSiteNameSnapshot : x.TargetSite.Name).ToListAsync(ct);
        var approvalSnapshot = await BuildApprovalSnapshot(run, allocations, requests, db, ct);
        run.Approve();
        run.WorkItem.ApplyApprovedPlan(run.ProposedPriority, run.ProposedDueAt, null, now);
        run.WorkItem.TransitionWithinLevel("planning_approved", null, now);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.approved", "workflow-run", run.Id, now));
        await FormalApprovalService.Approve(db, run.WorkItem.SiteId, "plan", run.Id, run.WorkItemId, $"Plan for {run.WorkItem.Title}", approvalSnapshot, personId, now, ct);
        DomainEventRecorder.Record(db, "plan.approved", run.WorkItem.SiteId, personId, "plan", run.Id, new { planId = run.Id, taskId = run.WorkItemId }, now);
        await db.SaveChangesAsync(ct);
    }

    internal static async Task<string?> Release(WorkflowRun run, Guid personId,
        Guid localInstanceId, FylkrenDbContext db, CancellationToken ct)
    {
        if (run.Status != "approved" || run.WorkItem.Status != "planning_approved") throw new InvalidOperationException("The plan is not ready for initiation.");
        var now = DateTimeOffset.UtcNow;
        var allocations = await db.WorkflowPlanAllocations.Include(x => x.Step).Include(x => x.Unit).Where(x => x.RunId == run.Id).OrderBy(x => x.Step.SortOrder).ThenBy(x => x.Unit.Name).ToListAsync(ct);
        var requests = await db.WorkflowPlanRequests.Include(x => x.Step).Include(x => x.TargetSite).Where(x => x.RunId == run.Id).OrderBy(x => x.Step.SortOrder).ThenBy(x => x.TargetSite == null ? x.TargetSiteNameSnapshot : x.TargetSite.Name).ToListAsync(ct);
        foreach (var remote in requests.Where(x => x.TargetInstanceId is not null))
        {
            if (remote.TargetInstanceId is not Guid peerInstanceId ||
                remote.RemoteSiteId is not Guid remoteSiteId ||
                !await FederationOutboundWorkQueue.AuthorizedAsync(run.WorkItem.SiteId,
                    peerInstanceId, remoteSiteId, db, ct))
                return "federation_outbound_not_authorized";
        }
        var source = await db.Sites.SingleAsync(x => x.Id == run.WorkItem.SiteId, ct);
        var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
        var sourceTypeName = run.WorkItem.SourceTypeId is Guid sourceTypeId ? await db.WorkItemLookups.Where(x => x.Id == sourceTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : run.WorkItem.SourceTypeNameSnapshot;
        var workItemTypeName = run.WorkItem.WorkItemTypeId is Guid workItemTypeId ? await db.WorkItemTypes.Where(x => x.Id == workItemTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : run.WorkItem.WorkItemTypeNameSnapshot;
        var senderName = run.WorkItem.SenderId is Guid senderId ? await db.WorkItemLookups.Where(x => x.Id == senderId).Select(x => x.Name).SingleOrDefaultAsync(ct) : run.WorkItem.SenderNameSnapshot;
        var requestType = requests.Count == 0 ? null : await db.WorkItemTypes.SingleAsync(x => x.SiteId == run.WorkItem.SiteId && x.IsSystemManaged, ct);
        var requestBasis = requests.Count == 0 ? null : await BuildRequestBasis(run, db, ct);
        foreach (var allocation in allocations)
        {
            var child = allocation.Unit.SiteId == run.WorkItem.SiteId
                ? WorkItem.CreateDelegated(Guid.NewGuid(), run.WorkItem, personId, allocation.UnitId, allocation.Unit.Name, allocation.Instruction, now)
                : WorkItem.CreateTransferred(Guid.NewGuid(), run.WorkItem, allocation.Unit.SiteId, personId, source.Name, actor.DisplayName, sourceTypeName, workItemTypeName, senderName, run.WorkItem.Id, allocation.Instruction, now);
            db.WorkItems.Add(child);
            DomainEventRecorder.Record(db, "assignment.created", child.SiteId, child.SiteId == run.WorkItem.SiteId ? personId : null, "task", child.Id, new { taskId = child.Id, parentTaskId = child.SiteId == run.WorkItem.SiteId ? run.WorkItem.Id : (Guid?)null, assignedUnitId = child.AssignedUnitId }, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), child.SiteId, personId, allocation.Unit.SiteId == run.WorkItem.SiteId ? "work-item.delegated" : "work-item.received-from-parent-site", "work-item", child.Id, now));
        }
        foreach (var plannedRequest in requests)
        {
            var recipientName = plannedRequest.TargetSite?.Name ?? plannedRequest.TargetSiteNameSnapshot!;
            var tracking = new WorkItem(Guid.NewGuid(), run.WorkItem.SiteId, personId,
                run.WorkItem.Title, plannedRequest.Instruction, run.WorkItem.ReferenceUrl,
                run.WorkItem.Priority, run.ProposedDueAt, now, run.WorkItem.Id, requestType!.Id,
                run.WorkItem.SourceTypeId, run.WorkItem.SenderId,
                sourceTypeNameSnapshot: sourceTypeName, senderNameSnapshot: senderName,
                requestBasisSnapshot: requestBasis);
            if (run.WorkItem.AssignedUnitId is Guid unitId) tracking.AssignToUnit(unitId, null, now);
            tracking.TransitionWithinLevel("in_progress", plannedRequest.TargetInstanceId is null
                ? $"The request has been sent to {recipientName} and is awaiting processing and a response."
                : $"The request has been queued for delivery to {recipientName}.", now);
            db.WorkItems.Add(tracking);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "work-item.request-sent-from-level", "work-item", tracking.Id, now));
            if (plannedRequest.TargetInstanceId is Guid peerInstanceId &&
                plannedRequest.RemoteSiteId is Guid remoteSiteId)
            {
                var outbound = await FederationOutboundWorkQueue.EnqueueAssignmentAsync(tracking,
                    peerInstanceId, remoteSiteId, localInstanceId, db, ct);
                if (outbound is null) return "federation_outbound_not_authorized";
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId,
                    "work-item.federated-request-queued", "work-item", tracking.Id, now));
            }
            else
            {
                var received = WorkItem.CreateTransferred(Guid.NewGuid(), tracking,
                    plannedRequest.TargetSiteId!.Value, personId, source.Name, actor.DisplayName,
                    sourceTypeName, "Request", senderName, null, plannedRequest.Instruction,
                    now, requestBasis);
                db.WorkItems.Add(received);
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), plannedRequest.TargetSiteId.Value,
                    personId, "work-item.request-received", "work-item", received.Id, now));
            }
        }
        run.WorkItem.TransitionWithinLevel("in_progress", "The approved plan has been initiated.", now);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.released", "workflow-run", run.Id, now));
        await db.SaveChangesAsync(ct);
        return null;
    }

    private static async Task<object> BuildApprovalSnapshot(WorkflowRun run, IReadOnlyList<WorkflowPlanAllocation> allocations, IReadOnlyList<WorkflowPlanRequest> requests, FylkrenDbContext db, CancellationToken ct)
    {
        var steps = await db.WorkflowSteps.AsNoTracking().Where(x => x.DefinitionId == run.DefinitionId).OrderBy(x => x.SortOrder)
            .Select(x => new { x.Id, x.Name, x.SortOrder, x.IsOptional, x.AllowsTaskAllocation, x.HasTimeline }).ToListAsync(ct);
        var documents = await db.WorkflowStepDocuments.AsNoTracking().Where(x => x.RunId == run.Id).OrderBy(x => x.StepId)
            .Select(x => new { x.StepId, x.Content, x.UpdatedAt }).ToListAsync(ct);
        var links = await db.WorkflowStepLinks.AsNoTracking().Where(x => x.RunId == run.Id).OrderBy(x => x.CreatedAt)
            .Select(x => new { x.StepId, x.Label, x.Url, x.CreatedAt }).ToListAsync(ct);
        var timeline = await db.WorkflowTimelineEvents.AsNoTracking().Where(x => x.RunId == run.Id).OrderBy(x => x.Date).ThenBy(x => x.SortOrder)
            .Select(x => new { x.StepId, x.Date, x.Description, x.SortOrder }).ToListAsync(ct);
        var rfi = await db.PlanningRfiEntries.AsNoTracking().Where(x => x.RunId == run.Id).OrderBy(x => x.CreatedAt).ThenBy(x => x.Id)
            .Select(x => new { x.Id, x.Who, x.What, x.DueOn, x.Answered, x.Answer, x.CreatedAt, x.UpdatedAt }).ToListAsync(ct);
        return new
        {
            task = new { run.WorkItem.Id, run.WorkItem.Title, run.WorkItem.Description, run.WorkItem.Priority, run.WorkItem.DueAt, run.WorkItem.AssignedUnitId },
            plan = new { run.Id, run.DefinitionId, run.ProposedPriority, run.ProposedDueAt, run.ProposedUnitId, run.TimelineStartedOn },
            steps, documents, links, timeline, rfi,
            allocations = allocations.Select(x => new { x.Id, x.StepId, x.UnitId, unit = x.Unit.Name, x.Instruction }),
            requests = requests.Select(x => new { x.Id, x.StepId,
                targetSiteId = x.TargetSiteId ?? x.RemoteSiteId,
                x.TargetInstanceId,
                targetSite = x.TargetSite?.Name ?? x.TargetSiteNameSnapshot,
                x.Instruction })
        };
    }

    internal static async Task<string> BuildRequestBasis(WorkflowRun run, FylkrenDbContext db, CancellationToken ct)
    {
        var steps = await db.WorkflowSteps.AsNoTracking().Where(x => x.DefinitionId == run.DefinitionId).OrderBy(x => x.SortOrder).Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var documents = await db.WorkflowStepDocuments.AsNoTracking().Where(x => x.RunId == run.Id).ToDictionaryAsync(x => x.StepId, x => x.Content, ct);
        var links = await db.WorkflowStepLinks.AsNoTracking().Where(x => x.RunId == run.Id).OrderBy(x => x.CreatedAt).Select(x => new { x.StepId, x.Label, x.Url }).ToListAsync(ct);
        var events = await db.WorkflowTimelineEvents.AsNoTracking().Where(x => x.RunId == run.Id).OrderBy(x => x.Date).ThenBy(x => x.SortOrder).Select(x => new { x.StepId, x.Date, x.Description }).ToListAsync(ct);
        var text = new StringBuilder().AppendLine("# Task basis").AppendLine().AppendLine("## Primary task description").AppendLine(run.WorkItem.Description);
        if (!string.IsNullOrWhiteSpace(run.WorkItem.ReferenceUrl)) text.AppendLine().AppendLine($"Primary document: {run.WorkItem.ReferenceUrl}");
        text.AppendLine().AppendLine("## Approved plan");
        foreach (var step in steps)
        {
            text.AppendLine().AppendLine($"### {step.Name}");
            if (documents.TryGetValue(step.Id, out var content) && !string.IsNullOrWhiteSpace(content)) text.AppendLine(content);
            foreach (var entry in events.Where(x => x.StepId == step.Id)) text.AppendLine($"- {entry.Date:yyyy-MM-dd}: {entry.Description}");
            foreach (var link in links.Where(x => x.StepId == step.Id)) text.AppendLine($"- {link.Label}: {link.Url}");
        }
        var result = text.ToString().Trim();
        return result.Length <= 100000 ? result : result[..100000];
    }
}
