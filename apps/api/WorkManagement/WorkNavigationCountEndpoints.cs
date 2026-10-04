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
            return Results.Ok(await Read(personId, db, ct));
        });
    }

    internal sealed record Counts(long Tasks, long Planning, long Execution, long Learning);
    internal static async Task<Counts> Read(Guid personId, FylkrenDbContext db, CancellationToken ct)
    {
        var siteIds = await db.SiteMemberships.AsNoTracking()
            .Where(value => value.PersonId == personId && value.IsActive && value.Person.IsActive && value.Site.IsActive)
            .Select(value => value.SiteId).Distinct().ToListAsync(ct);
        long tasks = 0;
        long planning = 0;
        long execution = 0;
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
            if (ledLevels.Length > 0)
                tasks = NumericBounds.AddCount(tasks, await WorkNavigationCountQuery.Tasks(items, ledLevels, db).LongCountAsync(ct));
            planning = NumericBounds.AddCount(planning, await PlanningQueueEndpoints.ActivePlanningRuns(db, siteId)
                .LongCountAsync(run => planningLevels.Contains(run.WorkItem.AssignedUnitId) &&
                    run.Status == "available" && run.ClaimedByPersonId == null, ct));
            execution = NumericBounds.AddCount(execution, await items.LongCountAsync(item => executionLevels.Contains(item.AssignedUnitId) &&
                item.Status == "execution" && (item.ExecutionRun == null || item.ExecutionRun.Status == "available"), ct));
        }
        var learning = await Fylkren.Api.Learning.LearningPolicy.PendingCount(personId, db, ct);
        return new Counts(tasks, planning, execution, learning);
    }
}
