using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemCommentEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/items/{itemId:guid}/comments", List);
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/comments", Add);
    }

    private static async Task<bool> CanComment(Guid siteId, Guid itemId, Guid personId, FylkrenDbContext db, CancellationToken ct) =>
        await IsMember(siteId, personId, db, ct) &&
        await db.WorkItems.AnyAsync(item => item.Id == itemId && item.SiteId == siteId, ct) &&
        (await LeadsSiteRoot(siteId, personId, db, ct) || await CanReadWorkTree(siteId, itemId, personId, db, ct));

    private static async Task<IResult> List(Guid siteId, Guid itemId, int? page, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId) || !await CanComment(siteId, itemId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var query = db.WorkItemComments.AsNoTracking().Where(value => value.SiteId == siteId && value.WorkItemId == itemId);
        var total = await query.CountAsync(ct);
        var currentPage = Math.Clamp(page ?? 1, 1, Math.Max(1, (total + 19) / 20));
        var items = await query.OrderByDescending(value => value.CreatedAt).ThenByDescending(value => value.Id)
            .Skip((currentPage - 1) * 20).Take(20)
            .Select(value => new { value.Id, value.AuthorPersonId, value.AuthorName, value.Text, value.CreatedAt }).ToListAsync(ct);
        return Results.Ok(new { items, total, page = currentPage });
    }

    private sealed record CommentRequest(string? Text);

    private static async Task<IResult> Add(Guid siteId, Guid itemId, CommentRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) || !await CanComment(siteId, itemId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var text = request.Text?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 10000)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["text"] = ["Enter a comment of 1 to 10000 characters."] });
        var authorName = await db.People.Where(value => value.Id == personId).Select(value => value.DisplayName).SingleAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var comment = new WorkItemComment(Guid.NewGuid(), siteId, itemId, personId, authorName, text, now);
        db.WorkItemComments.Add(comment);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.comment-added", "work-item", itemId, now), "comment.created", resourceType: "comment", resourceId: comment.Id);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/sites/{siteId}/items/{itemId}/comments", new { comment.Id });
    }
}
