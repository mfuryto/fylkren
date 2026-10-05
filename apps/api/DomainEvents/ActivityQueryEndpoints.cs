using System.Security.Claims;
using Fylkren.Api.Persistence;
using Fylkren.Api.Learning;
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
        // Work visibility alone never grants access to another level's private learning.
        var learningUnits = (await LearningPolicy.Levels(person, db, ct)).Where(x => x.SiteId == siteId).Select(x => x.UnitId).ToArray();
        query = query.Where(x => x.ResourceType != "learning" || db.LearningLessons.Any(lesson => lesson.Id == x.ResourceId && lesson.SiteId == siteId && lesson.WorkItemId == x.ContextWorkItemId && learningUnits.Contains(lesson.UnitId)));
        if (workItemId is Guid id) query = query.Where(x => x.ContextWorkItemId == id);
        return await Page(query, eventType, resourceType, from, until, before, beforeId, limit, db, ct);
    }
    internal static async Task<IResult> Page(IQueryable<DomainEvent> query, string? eventType, string? resourceType,
        DateTimeOffset? from, DateTimeOffset? until, DateTimeOffset? before, Guid? beforeId, int? limit, FylkrenDbContext db, CancellationToken ct)
    {
        if (eventType is not null) query = query.Where(x => x.ActivityType == eventType);
        if (resourceType is not null) query = query.Where(x => x.ResourceType == resourceType);
        if (from is not null) query = query.Where(x => x.OccurredAt >= from);
        if (until is not null) query = query.Where(x => x.OccurredAt < until);
        if (before is not null) query = query.Where(x => x.OccurredAt < before || x.OccurredAt == before && x.Id.CompareTo(beforeId!.Value) < 0);
        var size = limit ?? 25;
        var rows = await query.OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id).Take(size + 1)
            .Select(x => new { x.Id, type = x.ActivityType, x.OccurredAt, x.Source, x.ActorKind, x.ResourceType, x.ResourceId, x.ContextWorkItemId, x.ActivityMetadataJson, x.EffectKey, workReference = db.WorkItems.Where(w => w.Id == x.ContextWorkItemId).Select(w => w.ReferenceCode).FirstOrDefault(), actorName = x.ActorKind == "system" ? "System" : db.People.Where(p => p.Id == x.ActorPersonId).Select(p => p.DisplayName).FirstOrDefault() }).ToListAsync(ct);
        var items = rows.Take(size).ToArray(); var last = items.LastOrDefault();
        // Command effects carry the correlated audit UUID. Resolve this bounded page by
        // primary key rather than scanning all audit records for every timeline row.
        var auditIds = items.Select(x => Guid.TryParseExact(x.EffectKey, "N", out var id) ? id : Guid.Empty).Where(x => x != Guid.Empty).ToArray();
        var eventIds = items.Select(x => x.Id).ToArray();
        var actions = await db.AuditEvents.AsNoTracking().Where(x => auditIds.Contains(x.Id) && x.DomainEventId != null && eventIds.Contains(x.DomainEventId.Value))
            .ToDictionaryAsync(x => x.DomainEventId!.Value, x => x.EventType, ct);
        return Results.Ok(new { items = items.Select(x => {
            var step = x.ResourceType == "execution" ? ExecutionActivityDetails.Read(x.ActivityMetadataJson) : new ExecutionActivityDetails(null, null);
            return new { x.Id, x.type, x.OccurredAt, x.Source, x.ActorKind, x.ResourceType, x.ResourceId, x.ContextWorkItemId, x.workReference, x.actorName, action = actions.GetValueOrDefault(x.Id), step.StepNumber, step.StepName };
        }), hasMore = rows.Count > size, next = rows.Count > size && last is not null ? new { before = last.OccurredAt, beforeId = last.Id } : null,
            historyCoverage = "recorded-since-cutover" });
    }
}
