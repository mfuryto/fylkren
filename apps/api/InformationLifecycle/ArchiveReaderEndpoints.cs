using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal static class ArchiveReaderEndpoints
{
    internal static void MapArchiveReaderEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/information/archives").RequireAuthorization();
        group.MapGet("", async (ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var person)) return Results.Problem(statusCode: 403);
            return Results.Ok(await ArchiveAccess.Current(db, person).Select(g => new { g.SiteId, g.CanExport, name = db.Sites.Where(s => s.Id == g.SiteId).Select(s => s.Name).FirstOrDefault(), stage = db.InformationLifecycles.Where(l => l.ResourceType == "site" && l.ResourceId == g.SiteId).Select(l => l.Stage).FirstOrDefault() }).ToListAsync(ct));
        });
        group.MapGet("/{siteId:guid}/activity", Activity);
        group.MapGet("/{siteId:guid}/work-items", async (Guid siteId, Guid? itemId, int? limit, Guid? afterId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var person) || !await ArchiveAccess.CanRead(siteId, person, db, ct)) return Results.Problem(statusCode: 403);
            if (limit is < 1 or > 50) return Results.BadRequest();
            var query = db.WorkItems.AsNoTracking().Where(w => w.SiteId == siteId);
            if (itemId is Guid id) query = query.Where(w => w.Id == id);
            if (afterId is Guid after) query = query.Where(w => w.Id.CompareTo(after) > 0);
            var rows = await query.OrderBy(w => w.Id).Take((limit ?? 25) + 1).ToListAsync(ct);
            return Results.Ok(new { items = rows.Take(limit ?? 25), hasMore = rows.Count > (limit ?? 25), next = rows.Count > (limit ?? 25) ? (Guid?)rows[(limit ?? 25) - 1].Id : null });
        });
    }
    private static async Task<IResult> Activity(Guid siteId, string? eventType, string? resourceType, DateTimeOffset? from, DateTimeOffset? until,
        DateTimeOffset? before, Guid? beforeId, int? limit, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var person) || !await ArchiveAccess.CanRead(siteId, person, db, ct)) return Results.Problem(statusCode: 403);
        if (limit is < 1 or > 50 || from > until || (before is null) != (beforeId is null) || eventType is not null && !DomainEvents.ActivityEventCatalog.Types.Contains(eventType) || resourceType is not null && !DomainEvents.ActivityEventCatalog.Resources.Contains(resourceType)) return Results.BadRequest();
        var query = db.DomainEvents.AsNoTracking().Where(e => e.SiteId == siteId);
        return await DomainEvents.ActivityQueryEndpoints.Page(query, eventType, resourceType, from, until, before, beforeId, limit, db, ct);
    }
}
