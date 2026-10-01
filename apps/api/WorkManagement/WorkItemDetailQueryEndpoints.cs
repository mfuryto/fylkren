using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemDetailQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/items/{itemId:guid}/details", async (Guid siteId, Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!PersonId(user, out var personId) || !await IsMember(siteId, personId, db, ct))
                return Results.Problem(statusCode: 403);

            var now = DateTimeOffset.UtcNow;
            var item = await db.WorkItems
                .AsNoTracking()
                .Where(x => x.Id == itemId &&
                    (x.SiteId == siteId || x.ParentWorkItem != null && x.ParentWorkItem.SiteId == siteId))
                .Select(x => new
                {
                    x.SiteId,
                    x.ParentWorkItemId,
                    x.AssignedUnitId,
                    ParentIsRequest = x.ParentWorkItem != null &&
                        x.ParentWorkItem.WorkItemType != null &&
                        x.ParentWorkItem.WorkItemType.IsSystemManaged &&
                        x.ParentWorkItem.WorkItemType.IsSystemManaged,
                    CanRead = x.CreatedByPersonId == personId ||
                        x.AssignedUnitId != null && db.OrganizationUnitMemberships.Any(membership =>
                            membership.SiteId == siteId &&
                            membership.PersonId == personId &&
                            membership.OrganizationUnitId == x.AssignedUnitId &&
                            membership.OrganizationUnit.IsActive) ||
                        db.OrganizationUnitMemberships.Any(membership =>
                            membership.SiteId == siteId &&
                            membership.PersonId == personId &&
                            membership.OrganizationUnit.IsActive &&
                            membership.OrganizationUnit.WorksAtParentLevel &&
                            (x.AssignedUnitId == null
                                ? membership.OrganizationUnit.Parent != null &&
                                  (membership.OrganizationUnit.Parent.IsSiteLeadership ||
                                   membership.OrganizationUnit.Parent.IsSiteRoot)
                                : membership.OrganizationUnit.ParentId == x.AssignedUnitId)) ||
                        x.AssignedUnit != null && x.AssignedUnit.Roles.Any(role =>
                            role.Assignments.Any(assignment =>
                                assignment.PersonId == personId &&
                                assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now))) ||
                        x.ParentWorkItem != null &&
                        x.ParentWorkItem.AssignedUnit != null &&
                        x.ParentWorkItem.AssignedUnit.Roles.Any(role =>
                            role.Assignments.Any(assignment =>
                                assignment.PersonId == personId &&
                                assignment.IsActive &&
                                assignment.ValidFrom <= now &&
                                (assignment.ValidTo == null || assignment.ValidTo > now))) ||
                        db.WorkflowPlanAllocations.Any(allocation =>
                            allocation.Run.WorkItemId == x.Id &&
                            allocation.Unit.Roles.Any(role =>
                                role.Assignments.Any(assignment =>
                                    assignment.PersonId == personId &&
                                    assignment.IsActive &&
                                    assignment.ValidFrom <= now &&
                                    (assignment.ValidTo == null || assignment.ValidTo > now))))
                })
                .SingleOrDefaultAsync(ct);

            if (item is null)
                return Results.NotFound();
            if (item.SiteId != siteId && item.ParentIsRequest)
                return Results.Problem(
                    statusCode: 403,
                    title: "The recipient's internal processing is not available to the requesting site.");
            if (!item.CanRead &&
                !await LeadsSiteRoot(siteId, personId, db, ct) &&
                !await CanReadWorkTree(siteId, itemId, personId, db, ct))
                return Results.Problem(statusCode: 403);

            var task = await db.WorkItems
                .AsNoTracking()
                .Where(x => x.Id == itemId)
                .Select(x => new
                {
                    x.Id,
                    x.ParentWorkItemId,
                    x.Title,
                    x.Description,
                    x.Recommendation,
                    x.ReferenceUrl,
                    x.RequestBasisSnapshot,
                    type = x.WorkItemType == null ? x.WorkItemTypeNameSnapshot : x.WorkItemType.Name,
                    sourceType = x.SourceType == null ? x.SourceTypeNameSnapshot : x.SourceType.Name,
                    sender = x.Sender == null ? x.SenderNameSnapshot : x.Sender.Name,
                    x.SenderSiteName,
                    x.SenderPersonName,
                    x.Priority,
                    x.Status,
                    x.DueAt,
                    x.DecisionNote,
                    x.FinalReport,
                    x.FinalReportUpdatedAt,
                    unitName = x.AssignedUnit == null ? null : x.AssignedUnit.Name,
                    parentTitle = x.ParentWorkItem == null ? null : x.ParentWorkItem.Title,
                    createdBy = x.CreatedByPerson == null ? x.SenderSiteName ?? "Ekstern site" : x.CreatedByPerson.DisplayName,
                    x.CreatedAt
                })
                .SingleAsync(ct);

            if (item.SiteId != siteId)
                return Results.Ok(new { task, plan = (object?)null });

            var planOwnerId = await ResolvePlanOwnerId(itemId, item.ParentWorkItemId, db, ct);
            var plan = await db.WorkflowRuns
                .AsNoTracking()
                .Where(x => x.WorkItemId == planOwnerId)
                .OrderByDescending(x => x.StartedAt)
                .Select(x => new
                {
                    x.Id,
                    x.DefinitionId,
                    x.Status,
                    x.ProposedPriority,
                    x.ProposedDueAt,
                    x.TimelineStartedOn
                })
                .FirstOrDefaultAsync(ct);

            if (plan is null)
                return Results.Ok(new { task, plan });

            var stepRows = await db.WorkflowSteps
                .AsNoTracking()
                .Where(x => x.DefinitionId == plan.DefinitionId)
                .OrderBy(x => x.SortOrder)
                .Select(x => new { x.Id, x.Name, x.HasTimeline })
                .ToListAsync(ct);
            var documents = await db.WorkflowStepDocuments
                .AsNoTracking()
                .Where(x => x.RunId == plan.Id)
                .Select(x => new { x.StepId, x.Content })
                .ToListAsync(ct);
            var links = await db.WorkflowStepLinks
                .AsNoTracking()
                .Where(x => x.RunId == plan.Id)
                .OrderBy(x => x.CreatedAt)
                .Select(x => new { x.Id, x.StepId, x.Label, x.Url })
                .ToListAsync(ct);
            var allocations = await db.WorkflowPlanAllocations
                .AsNoTracking()
                .Where(x => x.RunId == plan.Id)
                .OrderBy(x => x.Step.SortOrder)
                .ThenBy(x => x.Unit.SortOrder)
                .Select(x => new { x.UnitId, stepName = x.Step.Name, unitName = x.Unit.Name, x.Instruction })
                .ToListAsync(ct);
            var requests = await db.WorkflowPlanRequests
                .AsNoTracking()
                .Where(x => x.RunId == plan.Id)
                .OrderBy(x => x.Step.SortOrder)
                .ThenBy(x => x.TargetSite == null ? x.TargetSiteNameSnapshot : x.TargetSite.Name)
                .Select(x => new { stepName = x.Step.Name,
                    targetSiteName = x.TargetSite == null ? x.TargetSiteNameSnapshot! : x.TargetSite.Name,
                    x.Instruction })
                .ToListAsync(ct);
            var timelineEvents = await db.WorkflowTimelineEvents
                .AsNoTracking()
                .Where(x => x.RunId == plan.Id)
                .OrderBy(x => x.Date)
                .ThenBy(x => x.SortOrder)
                .Select(x => new { x.Id, x.StepId, x.Date, x.Description })
                .ToListAsync(ct);
            var rfiEntries = await db.PlanningRfiEntries.AsNoTracking().Where(x => x.RunId == plan.Id)
                .OrderBy(x => x.CreatedAt).ThenBy(x => x.Id)
                .Select(x => new { x.Id, x.Who, x.What, x.DueOn, x.Answered, x.Answer, x.CreatedAt, x.UpdatedAt }).ToListAsync(ct);

            return Results.Ok(new
            {
                task,
                plan = new
                {
                    plan.Id,
                    ownerWorkItemId = planOwnerId,
                    plan.Status,
                    plan.ProposedPriority,
                    plan.ProposedDueAt,
                    plan.TimelineStartedOn,
                    steps = stepRows.Select(step => new
                    {
                        step.Id,
                        step.Name,
                        step.HasTimeline,
                        content = documents.FirstOrDefault(document => document.StepId == step.Id)?.Content,
                        links = links
                            .Where(link => link.StepId == step.Id)
                            .Select(link => new { link.Id, link.Label, link.Url }),
                        timelineEvents = timelineEvents
                            .Where(entry => entry.StepId == step.Id)
                            .Select(entry => new { entry.Id, entry.Date, entry.Description })
                    }),
                    allocations = item.ParentWorkItemId == planOwnerId && item.AssignedUnitId is Guid receivingUnitId
                        ? allocations.Where(allocation => allocation.UnitId == receivingUnitId)
                        : allocations,
                    requests,
                    rfi = rfiEntries.Where(_ => itemId == planOwnerId)
                }
            });
        });
    }

    private static async Task<Guid> ResolvePlanOwnerId(
        Guid itemId,
        Guid? parentWorkItemId,
        FylkrenDbContext db,
        CancellationToken ct)
    {
        var planOwnerId = itemId;
        var ancestorId = parentWorkItemId;
        var visited = new HashSet<Guid>();

        while (!await db.WorkflowRuns.AnyAsync(x => x.WorkItemId == planOwnerId, ct) &&
               ancestorId is Guid current &&
               visited.Add(current))
        {
            var ancestor = await db.WorkItems
                .AsNoTracking()
                .Where(x => x.Id == current)
                .Select(x => new { x.Id, x.ParentWorkItemId })
                .SingleOrDefaultAsync(ct);
            if (ancestor is null)
                break;

            planOwnerId = ancestor.Id;
            ancestorId = ancestor.ParentWorkItemId;
        }

        return planOwnerId;
    }
}
