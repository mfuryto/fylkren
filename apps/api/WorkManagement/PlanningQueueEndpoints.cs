using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningQueueEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/planning/sites/{siteId:guid}", async (Guid siteId, int? page, Guid? levelId, bool? topLevel, Guid? focusRunId, string? sort, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            const int pageSize = 20;
            if (!Pid(user, out var personId) ||
                !await OrganizationAuthorization.CanPlanInSite(siteId, personId, db, ct))
                return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, null) is { } queryError)
                return queryError;
            if (RequestQueryPolicy.ValidateChoice("sort", sort, "newest", "oldest", "name-asc", "name-desc", "reference-asc", "reference-desc") is { } sortError)
                return sortError;

            var candidateLevels = await ActivePlanningRuns(db, siteId)
                .Select(x => x.WorkItem.AssignedUnitId)
                .Distinct()
                .ToListAsync(ct);
            var levelAccess = await WorkLevelAuthorization.AccessForLevels(siteId, candidateLevels, personId, db, ct);
            var allowedLevels = levelAccess.Where(value => value.CanPlan).Select(value => value.LevelId).ToList();
            var managedLevels = levelAccess.Where(value => value.CanPlan && value.Leads).Select(value => value.LevelId).ToHashSet();
            var baseQuery = ActivePlanningRuns(db, siteId)
                .Where(x => allowedLevels.Contains(x.WorkItem.AssignedUnitId));
            var levels = await baseQuery
                .Select(x => new
                {
                    x.WorkItem.AssignedUnitId,
                    Name = x.WorkItem.AssignedUnit == null ? "Top level" : x.WorkItem.AssignedUnit.Name
                })
                .Distinct()
                .OrderBy(x => x.Name)
                .ToListAsync(ct);

            if (topLevel == true)
                baseQuery = baseQuery.Where(x => x.WorkItem.AssignedUnitId == null);
            else if (levelId is Guid selectedLevelId)
                baseQuery = baseQuery.Where(x => x.WorkItem.AssignedUnitId == selectedLevelId);

            var total = await baseQuery.LongCountAsync(ct);
            var pageNumber = Math.Max(page ?? 1, 1);
            if (focusRunId is Guid focusedRunId)
            {
                var focusedStartedAt = await baseQuery
                    .Where(x => x.Id == focusedRunId)
                    .Select(x => (DateTimeOffset?)x.StartedAt)
                    .SingleOrDefaultAsync(ct);
                if (focusedStartedAt is DateTimeOffset startedAt)
                    pageNumber = (int)Math.Min(RequestQueryPolicy.MaximumPage,
                        NumericBounds.PageForZeroBasedIndex(await baseQuery.LongCountAsync(x => x.StartedAt > startedAt, ct), pageSize));
            }
            var totalPages = Math.Max(1L, NumericBounds.Pages(total, pageSize));
            pageNumber = (int)Math.Min(pageNumber, totalPages);
            var orderedRuns = sort switch
            {
                "oldest" => baseQuery.OrderBy(x => x.StartedAt).ThenBy(x => x.Id),
                "name-asc" => baseQuery.OrderBy(x => x.WorkItem.Title).ThenBy(x => x.Id),
                "name-desc" => baseQuery.OrderByDescending(x => x.WorkItem.Title).ThenBy(x => x.Id),
                "reference-asc" => baseQuery.OrderBy(x => x.WorkItem.ReferenceCode).ThenBy(x => x.Id),
                "reference-desc" => baseQuery.OrderByDescending(x => x.WorkItem.ReferenceCode).ThenBy(x => x.Id),
                _ => baseQuery.OrderByDescending(x => x.StartedAt).ThenBy(x => x.Id),
            };
            var runs = await orderedRuns
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.Id,
                    x.Status,
                    x.CurrentStep,
                    x.StartedAt,
                    x.TimelineStartedOn,
                    x.ClaimedByPersonId,
                    claimedBy = x.ClaimedByPerson == null ? null : x.ClaimedByPerson.DisplayName,
                    x.ProposedUnitId,
                    proposedUnit = x.ProposedUnit == null ? null : x.ProposedUnit.Name,
                    x.ProposedPriority,
                    x.ProposedDueAt,
                    x.ResultNote,
                    item = new
                    {
                        x.WorkItem.Id,
                        x.WorkItem.ReferenceCode,
                        x.WorkItem.OriginReference,
                        x.WorkItem.ParentWorkItemId,
                        parentTitle = x.WorkItem.ParentWorkItem == null ? null : x.WorkItem.ParentWorkItem.Title,
                        parentDescription = x.WorkItem.ParentWorkItem == null ? null : x.WorkItem.ParentWorkItem.Description,
                        x.WorkItem.RequestBasisSnapshot,
                        x.WorkItem.AssignedUnitId,
                        assignedUnitName = x.WorkItem.AssignedUnit == null ? null : x.WorkItem.AssignedUnit.Name,
                        x.WorkItem.Title,
                        x.WorkItem.Description,
                        x.WorkItem.ReferenceUrl,
                        workItemTypeName = x.WorkItem.WorkItemType == null ? null : x.WorkItem.WorkItemType.Name,
                        sourceTypeName = x.WorkItem.SourceType == null ? null : x.WorkItem.SourceType.Name,
                        senderName = x.WorkItem.Sender == null ? null : x.WorkItem.Sender.Name,
                        x.WorkItem.Priority,
                        x.WorkItem.DueAt,
                        x.WorkItem.DecisionNote,
                        x.WorkItem.FinalReport,
                        finalReportWrittenBy = x.WorkItem.FinalReportWrittenByPerson == null
                            ? null
                            : x.WorkItem.FinalReportWrittenByPerson.DisplayName,
                        x.WorkItem.FinalReportUpdatedAt,
                        createdBy = x.WorkItem.CreatedByPerson == null ? x.WorkItem.SenderSiteName ?? "External site" : x.WorkItem.CreatedByPerson.DisplayName,
                        x.WorkItem.CreatedAt
                    },
                    steps = x.Definition.Steps
                        .OrderBy(step => step.SortOrder)
                        .Select(step => new
                        {
                            step.Id,
                            step.Name,
                            step.SortOrder,
                            step.IsOptional,
                            step.AllowsTaskAllocation,
                            step.HasTimeline,
                            content = db.WorkflowStepDocuments
                                .Where(document => document.RunId == x.Id && document.StepId == step.Id)
                                .Select(document => document.Content)
                                .FirstOrDefault()
                        }),
                    allocations = x.Allocations
                        .OrderBy(allocation => allocation.Step.SortOrder)
                        .ThenBy(allocation => allocation.Unit.Name)
                        .Select(allocation => new
                        {
                            allocation.Id,
                            allocation.StepId,
                            stepName = allocation.Step.Name,
                            allocation.UnitId,
                            unitName = allocation.Unit.Name,
                            allocation.Instruction
                        })
                })
                .ToListAsync(ct);
            var runIds = runs.Select(x => x.Id).ToList();
            var plannedRequests = await db.WorkflowPlanRequests.AsNoTracking().Where(x => runIds.Contains(x.RunId)).OrderBy(x => x.Step.SortOrder).ThenBy(x => x.TargetSite == null ? x.TargetSiteNameSnapshot : x.TargetSite.Name).Select(x => new { x.Id, x.RunId, x.StepId, stepName = x.Step.Name, TargetSiteId = x.TargetSiteId ?? x.RemoteSiteId!.Value, targetInstanceId = x.TargetInstanceId, targetSiteName = x.TargetSite == null ? x.TargetSiteNameSnapshot! : x.TargetSite.Name, x.Instruction }).ToListAsync(ct);
            var rfiEntries = await db.PlanningRfiEntries.AsNoTracking().Where(x => runIds.Contains(x.RunId)).OrderBy(x => x.CreatedAt).ThenBy(x => x.Id)
                .Select(x => new { x.Id, x.RunId, x.Who, x.What, x.DueOn, x.Answered, x.Answer, x.CreatedAt, x.UpdatedAt }).ToListAsync(ct);
            var links = await db.WorkflowStepLinks.AsNoTracking().Where(x => runIds.Contains(x.RunId)).OrderBy(x => x.CreatedAt).Select(x => new { x.Id, x.RunId, x.StepId, x.Label, x.Url }).ToListAsync(ct);
            var timelineEvents = await db.WorkflowTimelineEvents.AsNoTracking().Where(x => runIds.Contains(x.RunId)).OrderBy(x => x.Date).ThenBy(x => x.SortOrder).Select(x => new { x.Id, x.RunId, x.StepId, x.Date, x.Description }).ToListAsync(ct);
            var hierarchy = await WorkItemAncestryLoader.Load(siteId, runs.Select(x => x.item.ParentWorkItemId), db, ct);
            var items = runs.Select(run => new
            {
                run.Id,
                run.Status,
                run.CurrentStep,
                run.StartedAt,
                run.TimelineStartedOn,
                run.ClaimedByPersonId,
                run.claimedBy,
                canManage = managedLevels.Contains(run.item.AssignedUnitId),
                run.ProposedUnitId,
                run.proposedUnit,
                run.ProposedPriority,
                run.ProposedDueAt,
                run.ResultNote,
                run.item,
                ancestors = BuildAncestors(run.item.ParentWorkItemId, hierarchy),
                steps = run.steps.Select(step => new
                {
                    step.Id,
                    step.Name,
                    step.SortOrder,
                    step.IsOptional,
                    step.AllowsTaskAllocation,
                    step.HasTimeline,
                    step.content,
                    timelineEvents = timelineEvents
                        .Where(entry => entry.RunId == run.Id && entry.StepId == step.Id)
                        .Select(entry => new { entry.Id, entry.Date, entry.Description }),
                    links = links
                        .Where(link => link.RunId == run.Id && link.StepId == step.Id)
                        .Select(link => new { link.Id, link.Label, link.Url })
                }),
                run.allocations,
                requests = plannedRequests
                    .Where(request => request.RunId == run.Id)
                    .Select(request => new
                    {
                        request.Id,
                        request.StepId,
                        request.stepName,
                        request.TargetSiteId,
                        request.targetInstanceId,
                        request.targetSiteName,
                        request.Instruction
                    }),
                rfi = rfiEntries.Where(entry => entry.RunId == run.Id).Select(entry => new
                {
                    entry.Id, entry.Who, entry.What, entry.DueOn, entry.Answered, entry.Answer, entry.CreatedAt, entry.UpdatedAt
                })
            });
            return Results.Ok(new { items, levels, total, page = pageNumber, pageSize, totalPages });
        });
    }

    internal static IQueryable<WorkflowRun> ActivePlanningRuns(FylkrenDbContext db, Guid siteId) =>
        db.WorkflowRuns
            .AsNoTracking()
            .Where(run =>
                run.WorkItem.SiteId == siteId &&
                run.WorkItem.Status != "on_hold" &&
                run.WorkItem.Status != "cancelled" &&
                run.Definition.Kind == "planning" &&
                run.Status != "awaiting_approval" &&
                run.Status != "approved" &&
                run.Status != "rejected" &&
                run.Status != "cancelled");

    private static IReadOnlyList<PlanningAncestor> BuildAncestors(Guid? parentId, IReadOnlyDictionary<Guid, WorkItemAncestryLoader.Node> hierarchy)
    {
        var result = new List<PlanningAncestor>();
        var visited = new HashSet<Guid>();
        var current = parentId;
        var distance = 1;
        while (current is Guid id && visited.Add(id) && hierarchy.TryGetValue(id, out var node))
        {
            if (node.HasPlan) result.Add(new PlanningAncestor(node.Id, node.Title, distance));
            current = node.ParentWorkItemId;
            distance++;
        }
        return result;
    }

    private sealed record PlanningAncestor(Guid Id, string Title, int Distance);
}
