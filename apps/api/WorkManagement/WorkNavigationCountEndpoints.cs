using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkNavigationCountEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/navigation-counts", async (ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId))
                return Results.Problem(statusCode: 403);
            var siteIds = await db.SiteMemberships.AsNoTracking()
                .Where(value => value.PersonId == personId && value.IsActive && value.Person.IsActive && value.Site.IsActive)
                .Select(value => value.SiteId).Distinct().ToListAsync(ct);
            var tasks = 0;
            var planning = 0;
            var execution = 0;
            foreach (var siteId in siteIds)
            {
                var items = db.WorkItems.AsNoTracking().Where(item => item.SiteId == siteId &&
                    item.Status != "completed" && item.Status != "rejected" &&
                    item.Status != "cancelled" && item.Status != "reassigned" && item.Status != "on_hold");
                var levels = await items.Select(item => item.AssignedUnitId).Distinct().ToListAsync(ct);
                var access = await WorkLevelAuthorization.AccessForLevels(siteId, levels, personId, db, ct);
                var ledLevels = access.Where(value => value.Leads).Select(value => value.LevelId).ToArray();
                var planningLevels = access.Where(value => value.CanPlan).Select(value => value.LevelId).ToArray();
                var executionLevels = access.Where(value => value.Belongs).Select(value => value.LevelId).ToArray();
                var candidates = items.Where(item => ledLevels.Contains(item.AssignedUnitId) &&
                    (item.Status == "registered" || item.Status == "under_review" ||
                     item.Status == "planning_approval" || item.Status == "planning_approved" ||
                     item.Status == "in_review" || item.Status == "request_cancelled" ||
                     ((item.Status == "assigned" || item.Status == "in_progress") &&
                      !db.WorkItems.Any(child => child.ParentWorkItemId == item.Id &&
                          child.Status != "completed" && child.Status != "rejected" &&
                          child.Status != "cancelled" && child.Status != "reassigned"))));
                var summaries = await WorkItemSummaryProjection.Project(candidates, siteId, personId, DateTimeOffset.UtcNow, db)
                    .Select(item => new { item.Id, item.IsOutgoingRequest, item.RequestProgressStatus, item.IsBlocked })
                    .ToListAsync(ct);
                tasks += summaries.Count(item => !item.IsBlocked && (!item.IsOutgoingRequest ||
                    item.RequestProgressStatus == "completed" || item.RequestProgressStatus == "rejected" ||
                    item.RequestProgressStatus == "cancelled"));
                planning += await PlanningQueueEndpoints.ActivePlanningRuns(db, siteId)
                    .CountAsync(run => planningLevels.Contains(run.WorkItem.AssignedUnitId) &&
                        run.Status == "available" && run.ClaimedByPersonId == null, ct);
                execution += await items.CountAsync(item => executionLevels.Contains(item.AssignedUnitId) &&
                    item.Status == "execution" && (item.ExecutionRun == null || item.ExecutionRun.Status == "available"), ct);
            }
            return Results.Ok(new { tasks, planning, execution });
        });
    }
}
