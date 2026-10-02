using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemListQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/items", async (Guid siteId, Guid? unitId, string? filter, string? search, string? sort, int? page, Guid? focusItemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!PersonId(user, out var personId) || !await WorkLevelAuthorization.HasOperationalAccess(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, search) is { } queryError) return queryError;
            var now = DateTimeOffset.UtcNow;
            var query = await WorkItemVisibility.QueryForPerson(siteId, personId, now, db, ct);
            var selection = await WorkItemQueuePager.Select(query, siteId, unitId, filter ?? "active", search, sort ?? "newest", page ?? 1, focusItemId, db, ct);
            var summaries = await WorkItemSummaryProjection.Project(query.Where(item => selection.ItemIds.Contains(item.Id)), siteId, personId, now, db)
                .ToListAsync(ct);
            var itemOrder = selection.OrderedItemIds.Select((id, index) => new { id, index })
                .ToDictionary(value => value.id, value => value.index);
            summaries.Sort((left, right) => itemOrder[left.Id].CompareTo(itemOrder[right.Id]));
            return Results.Ok(new { items = summaries, selection.Total, selection.Page, selection.PageSize, selection.TotalPages, selection.Summary });
        });

        group.MapGet("/sites/{siteId:guid}/items/overview", async (Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!PersonId(user, out var personId) || !await WorkLevelAuthorization.HasOperationalAccess(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var now = DateTimeOffset.UtcNow;
            var query = await WorkItemVisibility.QueryForPerson(siteId, personId, now, db, ct);
            var summaries = await WorkItemSummaryProjection.Project(query, siteId, personId, now, db).ToListAsync(ct);
            return Results.Ok(summaries);
        });
    }
}
