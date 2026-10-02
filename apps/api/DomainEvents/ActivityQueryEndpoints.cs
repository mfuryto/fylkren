using System.Security.Claims;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.DomainEvents;

internal static class ActivityQueryEndpoints
{
    internal static void MapActivityQueryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/activity/sites/{siteId:guid}", Query).RequireAuthorization();
    }

    private static async Task<IResult> Query(Guid siteId, Guid? workItemId, string? eventType, string? resourceType,
        DateTimeOffset? from, DateTimeOffset? until, DateTimeOffset? before, Guid? beforeId, int? limit,
        ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var person) || !await IsMember(siteId, person, db, ct)) return Results.Problem(statusCode: 403);
        if (limit is < 1 or > 50 || eventType is not null && !ActivityEventCatalog.Types.Contains(eventType) ||
            resourceType is not null && !ActivityEventCatalog.Resources.Contains(resourceType) ||
            from > until || (before is null) != (beforeId is null)) return Results.BadRequest();
        var visible = await WorkItemVisibility.QueryForPerson(siteId, person, DateTimeOffset.UtcNow, db, ct);
        var ids = visible.Where(x => x.SiteId == siteId).Select(x => x.Id);
        if (workItemId is Guid root && !await ids.AnyAsync(x => x == root, ct)) return Results.Problem(statusCode: 403);
        var query = db.DomainEvents.AsNoTracking().Where(x => x.SiteId == siteId && x.ContextWorkItemId != null && ids.Contains(x.ContextWorkItemId.Value));
        if (workItemId is Guid id) query = query.Where(x => x.ContextWorkItemId == id);
        if (eventType is not null) query = query.Where(x => x.ActivityType == eventType);
        if (resourceType is not null) query = query.Where(x => x.ResourceType == resourceType);
        if (from is not null) query = query.Where(x => x.OccurredAt >= from);
        if (until is not null) query = query.Where(x => x.OccurredAt <= until);
        if (before is not null) query = query.Where(x => x.OccurredAt < before || x.OccurredAt == before && x.Id.CompareTo(beforeId!.Value) < 0);
        var size = limit ?? 25;
        var rows = await query.OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id).Take(size + 1)
            .Select(x => new { x.Id, type = x.ActivityType, x.OccurredAt, x.Source, x.ActorKind, x.ResourceType, x.ResourceId, x.ContextWorkItemId, workReference = db.WorkItems.Where(w => w.Id == x.ContextWorkItemId).Select(w => w.ReferenceCode).FirstOrDefault(), actorName = db.People.Where(p => p.Id == x.ActorPersonId).Select(p => p.DisplayName).FirstOrDefault() }).ToListAsync(ct);
        var items = rows.Take(size).ToArray(); var last = items.LastOrDefault();
        return Results.Ok(new { items, hasMore = rows.Count > size, next = rows.Count > size && last is not null ? new { before = last.OccurredAt, beforeId = last.Id } : null,
            historyCoverage = "recorded-since-cutover" });
    }
}
