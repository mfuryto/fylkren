using System.Security.Claims;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.ExecutionEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class ExecutionQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}", async (Guid siteId, int? page, Guid? focusItemId, string? sort, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            const int pageSize = 20;
            if (!PersonId(user, out var personId) ||
                !await WorkLevelAuthorization.HasOperationalAccess(siteId, personId, db, ct))
                return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, null) is { } queryError)
                return queryError;

            var candidateLevels = await db.WorkItems
                .AsNoTracking()
                .Where(x => x.SiteId == siteId && x.Status == "execution")
                .Select(x => x.AssignedUnitId)
                .Distinct()
                .ToListAsync(ct);
            var levelAccess = await WorkLevelAuthorization.AccessForLevels(siteId, candidateLevels, personId, db, ct);
            var allowedLevels = levelAccess.Where(value => value.Belongs).Select(value => value.LevelId).ToList();
            var accessByLevel = levelAccess.ToDictionary(value => value.LevelId ?? Guid.Empty);
            var baseQuery = db.WorkItems
                .AsNoTracking()
                .Where(x => x.SiteId == siteId &&
                    x.Status == "execution" &&
                    allowedLevels.Contains(x.AssignedUnitId));
            var total = await baseQuery.LongCountAsync(ct);
            var pageNumber = Math.Max(page ?? 1, 1);
            if (focusItemId is Guid focusedItemId)
            {
                var focusedCreatedAt = await baseQuery
                    .Where(x => x.Id == focusedItemId)
                    .Select(x => (DateTimeOffset?)x.CreatedAt)
                    .SingleOrDefaultAsync(ct);
                if (focusedCreatedAt is DateTimeOffset createdAt)
                    pageNumber = (int)Math.Min(RequestQueryPolicy.MaximumPage,
                        NumericBounds.PageForZeroBasedIndex(await baseQuery.LongCountAsync(x => x.CreatedAt > createdAt, ct), pageSize));
            }
            var totalPages = Math.Max(1L, NumericBounds.Pages(total, pageSize));
            pageNumber = (int)Math.Min(pageNumber, totalPages);
            var orderedItems = sort switch
            {
                "oldest" => baseQuery.OrderBy(x => x.CreatedAt).ThenBy(x => x.Id),
                "name-asc" => baseQuery.OrderBy(x => x.Title).ThenBy(x => x.Id),
                "name-desc" => baseQuery.OrderByDescending(x => x.Title).ThenBy(x => x.Id),
                "reference-asc" => baseQuery.OrderBy(x => x.ReferenceCode).ThenBy(x => x.Id),
                "reference-desc" => baseQuery.OrderByDescending(x => x.ReferenceCode).ThenBy(x => x.Id),
                _ => baseQuery.OrderByDescending(x => x.CreatedAt).ThenBy(x => x.Id),
            };
            var items = await orderedItems
                .Skip((pageNumber - 1) * pageSize)
                .Take(pageSize)
                .Select(x => new
                {
                    x.Id,
                    x.ReferenceCode,
                    x.OriginReference,
                    x.ParentWorkItemId,
                    x.AssignedUnitId,
                    assignedUnitName = x.AssignedUnit == null ? null : x.AssignedUnit.Name,
                    x.Title,
                    x.Description,
                    x.RequestBasisSnapshot,
                    x.Recommendation,
                    x.ReferenceUrl,
                    x.Priority,
                    x.DueAt,
                    x.DecisionNote,
                    createdBy = x.CreatedByPerson == null ? x.SenderSiteName ?? "External site" : x.CreatedByPerson.DisplayName,
                    x.CreatedAt,
                    hasPlan = x.WorkflowRun != null && x.WorkflowRun.Definition.Kind == "planning",
                    run = x.ExecutionRun == null
                        ? null
                        : new
                        {
                            x.ExecutionRun.Id,
                            x.ExecutionRun.DefinitionId,
                            definitionName = x.ExecutionRun.Definition == null
                                ? null
                                : x.ExecutionRun.Definition.Name,
                            x.ExecutionRun.ClaimedByPersonId,
                            claimedBy = x.ExecutionRun.ClaimedByPerson == null
                                ? null
                                : x.ExecutionRun.ClaimedByPerson.DisplayName,
                            x.ExecutionRun.Status,
                            x.ExecutionRun.CurrentStep,
                            x.ExecutionRun.TimelineStartedOn,
                            steps = x.ExecutionRun.Definition == null
                                ? null
                                : x.ExecutionRun.Definition.Steps
                                    .OrderBy(step => step.SortOrder)
                                    .Select(step => new
                                    {
                                        step.Id,
                                        step.Name,
                                        step.SortOrder,
                                        step.IsOptional,
                                        step.HasTimeline,
                                        content = x.ExecutionRun.Documents
                                            .Where(document => document.StepId == step.Id)
                                            .Select(document => document.Content)
                                            .FirstOrDefault(),
                                        timelineEvents = x.ExecutionRun.TimelineEvents
                                            .Where(entry => entry.StepId == step.Id)
                                            .OrderBy(entry => entry.Date)
                                            .ThenBy(entry => entry.SortOrder)
                                            .Select(entry => new { entry.Id, entry.Date, entry.Description }),
                                        externalRequests = x.ExecutionRun.ExternalRequests
                                            .Where(request => request.StepId == step.Id)
                                            .OrderBy(request => request.CreatedAt)
                                            .Select(request => new
                                            {
                                                request.Id,
                                                request.Recipient,
                                                request.RequestText,
                                                request.ResponseText,
                                                request.Status,
                                                request.CreatedAt,
                                                request.UpdatedAt
                                            })
                                    })
                        }
                })
                .ToListAsync(ct);
            var managedItemIds = items.Where(item => accessByLevel[item.AssignedUnitId ?? Guid.Empty].Leads).Select(item => item.Id).ToList();
            var targetIds = items.Select(x => x.AssignedUnitId).Distinct().ToList();
            var definitionOwnerIds = await WorkLevelAuthorization.ConfigurationLineage(siteId, targetIds, db, ct);
            var hierarchy = await WorkItemAncestryLoader.Load(siteId, items.Select(x => (Guid?)x.Id), db, ct);
            var planContextIds = BuildPlanContextIds(items.Select(x => x.Id), hierarchy);
            var definitions = await db.WorkflowDefinitions
                .AsNoTracking()
                .Where(x => x.SiteId == siteId &&
                    x.IsActive &&
                    x.Kind == "execution" &&
                    (x.OwnerUnitId == null || definitionOwnerIds.Contains(x.OwnerUnitId.Value)))
                .OrderBy(x => x.Name)
                .Select(x => new
                {
                    x.Id,
                    x.Name,
                    x.OwnerUnitId,
                    ownerUnitName = x.OwnerUnit == null ? null : x.OwnerUnit.Name
                })
                .ToListAsync(ct);
            return Results.Ok(new
            {
                items,
                definitions,
                managedItemIds,
                planContextIds,
                total,
                page = pageNumber,
                pageSize,
                totalPages
            });
        });

        group.MapGet("/items/{itemId:guid}/history", async (Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!PersonId(user, out var personId))
                return Results.Problem(statusCode: 403);
            var item = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(x => x.Id == itemId, ct);
            if (item is null)
                return Results.NotFound();
            var canReadFromParent = false;
            if (item.ParentWorkItemId is Guid parentId)
            {
                var parentUnitId = await db.WorkItems
                    .AsNoTracking()
                    .Where(x => x.Id == parentId)
                    .Select(x => x.AssignedUnitId)
                    .SingleOrDefaultAsync(ct);
                canReadFromParent = await WorkLevelAuthorization.LeadsLevel(
                    item.SiteId, parentUnitId, personId, db, ct);
            }
            if (!await WorkLevelAuthorization.BelongsToLevel(item.SiteId, item.AssignedUnitId, personId, db, ct) &&
                !await WorkLevelAuthorization.LeadsLevel(item.SiteId, item.AssignedUnitId, personId, db, ct) &&
                !canReadFromParent)
                return Results.Problem(statusCode: 403);

            var history = await db.ExecutionRuns
                .AsNoTracking()
                .Where(run => run.WorkItemId == itemId)
                .Select(run => new
                {
                    run.Id,
                    definitionName = run.Definition == null ? null : run.Definition.Name,
                    run.Status,
                    run.TimelineStartedOn,
                    steps = run.Definition == null
                        ? null
                        : run.Definition.Steps
                            .OrderBy(step => step.SortOrder)
                            .Select(step => new
                            {
                                step.Id,
                                step.Name,
                                step.HasTimeline,
                                content = run.Documents
                                    .Where(document => document.StepId == step.Id)
                                    .Select(document => document.Content)
                                    .FirstOrDefault(),
                                timelineEvents = run.TimelineEvents
                                    .Where(entry => entry.StepId == step.Id)
                                    .OrderBy(entry => entry.Date)
                                    .ThenBy(entry => entry.SortOrder)
                                    .Select(entry => new { entry.Id, entry.Date, entry.Description }),
                                externalRequests = run.ExternalRequests
                                    .Where(request => request.StepId == step.Id)
                                    .OrderBy(request => request.CreatedAt)
                                    .Select(request => new
                                    {
                                        request.Id,
                                        request.Recipient,
                                        request.RequestText,
                                        request.ResponseText,
                                        request.Status
                                    })
                            })
                })
                .SingleOrDefaultAsync(ct);
            return Results.Ok(history);
        });
    }

    private static Dictionary<Guid, Guid> BuildPlanContextIds(
        IEnumerable<Guid> itemIds,
        IReadOnlyDictionary<Guid, WorkItemAncestryLoader.Node> hierarchy)
    {
        var result = new Dictionary<Guid, Guid>();
        foreach (var itemId in itemIds)
        {
            Guid? current = itemId;
            var visited = new HashSet<Guid>();
            while (current is Guid id && visited.Add(id) && hierarchy.TryGetValue(id, out var node))
            {
                if (node.HasPlan)
                {
                    result[itemId] = id;
                    break;
                }
                current = node.ParentWorkItemId;
            }
        }
        return result;
    }
}
