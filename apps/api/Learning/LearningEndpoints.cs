using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.WorkManagement;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Learning;

internal static class LearningEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/learning", async (Guid? siteId, Guid? unitId, Guid? workItemId, string? view, string? kind, string? priority, string? search, string? sort, int? page, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, search) is { } queryError) return queryError;
            if (RequestQueryPolicy.ValidateChoice("view", view, "active", "closed", "all") is { } viewError) return viewError;
            if (RequestQueryPolicy.ValidateChoice("kind", kind, "positive", "improvement") is { } kindError) return kindError;
            if (RequestQueryPolicy.ValidateChoice("priority", priority, "high", "normal", "low") is { } priorityError) return priorityError;
            if (RequestQueryPolicy.ValidateChoice("sort", sort, "priority", "due", "newest", "oldest") is { } sortError) return sortError;
            var levels = await LearningPolicy.Levels(personId, db, ct);
            if (levels.Count == 0) return Results.Problem(statusCode: 403);
            if (siteId is Guid site && !levels.Any(value => value.SiteId == site) || unitId is Guid unit && !levels.Any(value => value.UnitId == unit && (siteId == null || value.SiteId == siteId)))
                return Results.Problem(statusCode: 403);
            var unitIds = levels.Where(value => (siteId == null || value.SiteId == siteId) && (unitId == null || value.UnitId == unitId)).Select(value => value.UnitId).ToArray();
            var managedIds = levels.Where(value => value.CanManage).Select(value => value.UnitId).ToArray();
            var query = db.LearningLessons.AsNoTracking().Where(value => unitIds.Contains(value.UnitId));
            if (workItemId is Guid itemId) query = query.Where(value => value.WorkItemId == itemId);
            if (view == "closed") query = query.Where(value => value.Status == "implemented" || value.Status == "dismissed");
            else if (view != "all") query = query.Where(value => value.Status == "new" || value.Status == "in_progress");
            if (kind is "positive" or "improvement") query = query.Where(value => value.Kind == kind);
            if (priority is "high" or "normal" or "low") query = query.Where(value => value.Priority == priority);
            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = RequestQueryPolicy.LikePattern(search);
                query = query.Where(value => EF.Functions.ILike(value.Text, pattern, "\\") ||
                    db.WorkItems.Any(item => item.Id == value.WorkItemId && (EF.Functions.ILike(item.ReferenceCode, pattern, "\\") || EF.Functions.ILike(item.Title, pattern, "\\"))));
            }
            const int pageSize = 20;
            var total = await query.LongCountAsync(ct);
            var totalPages = Math.Max(1L, NumericBounds.Pages(total, pageSize));
            var pageNumber = (int)Math.Min(page ?? 1, totalPages);
            var ordered = sort switch
            {
                "oldest" => query.OrderBy(value => value.CreatedAt),
                "newest" => query.OrderByDescending(value => value.CreatedAt),
                "due" => query.OrderBy(value => value.DueOn == null).ThenBy(value => value.DueOn),
                _ => query.OrderBy(value => value.Priority == "high" ? 0 : value.Priority == "normal" ? 1 : 2).ThenBy(value => value.DueOn == null).ThenBy(value => value.DueOn).ThenBy(value => value.CreatedAt)
            };
            var items = await ordered.ThenBy(value => value.Id).Skip((pageNumber - 1) * pageSize).Take(pageSize)
                .Select(value => new
                {
                    value.Id, value.SiteId, value.UnitId, value.WorkItemId, value.Number, value.Kind, value.Text,
                    value.AuthorName, value.CreatedAt, value.UpdatedAt, value.Status, value.Priority, value.ActionPlan,
                    value.TreatmentNote, value.DueOn, value.OwnerName, value.Version,
                    canManage = managedIds.Contains(value.UnitId),
                    workReference = db.WorkItems.Where(item => item.Id == value.WorkItemId).Select(item => item.ReferenceCode).First(),
                    workTitle = db.WorkItems.Where(item => item.Id == value.WorkItemId).Select(item => item.Title).First()
                }).ToListAsync(ct);
            return Results.Ok(new { items, levels, total, page = pageNumber, pageSize, totalPages });
        });
        group.MapGet("/learning/{lessonId:guid}/entries", async (Guid lessonId, int? page, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!WorkItemPolicy.PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var lesson = await db.LearningLessons.AsNoTracking().SingleOrDefaultAsync(value => value.Id == lessonId, ct);
            if (lesson is null) return Results.NotFound();
            if (!(await LearningPolicy.Levels(personId, db, ct)).Any(value => value.UnitId == lesson.UnitId)) return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, null) is { } error) return error;
            var query = db.LearningEntries.AsNoTracking().Where(value => value.LessonId == lessonId);
            var total = await query.LongCountAsync(ct);
            var totalPages = Math.Max(1L, NumericBounds.Pages(total, 20));
            var pageNumber = (int)Math.Min(page ?? 1, totalPages);
            var items = await query.OrderByDescending(value => value.CreatedAt).ThenBy(value => value.Id).Skip((pageNumber - 1) * 20).Take(20).ToListAsync(ct);
            return Results.Ok(new { items, total, page = pageNumber, totalPages });
        });
        group.MapPost("/learning/{lessonId:guid}/comments", Comment);
        group.MapPut("/learning/{lessonId:guid}/review", Review);
    }

    private static async Task<IResult> Comment(Guid lessonId, CommentRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!WorkItemPolicy.PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var lesson = await db.LearningLessons.SingleOrDefaultAsync(value => value.Id == lessonId, ct);
        if (lesson is null) return Results.NotFound();
        if (!(await LearningPolicy.Levels(personId, db, ct)).Any(value => value.UnitId == lesson.UnitId)) return Results.Problem(statusCode: 403);
        var text = request.Text?.Trim() ?? "";
        if (text.Length is < 2 or > 4000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["text"] = ["Write 2–4,000 characters."] });
        var now = DateTimeOffset.UtcNow;
        var author = await db.People.Where(value => value.Id == personId).Select(value => value.DisplayName).SingleAsync(ct);
        var entry = new LearningEntry(Guid.NewGuid(), lesson.SiteId, lesson.Id, personId, author, "comment", text, now);
        db.LearningEntries.Add(entry);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), lesson.SiteId, personId, "learning.comment-added", "work-item", lesson.WorkItemId, now), "learning.comment_added", resourceType: "learning", resourceId: lesson.Id, metadataJson: "{}");
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/learning/{lesson.Id}/entries", new { entry.Id });
    }

    private static async Task<IResult> Review(Guid lessonId, ReviewRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!WorkItemPolicy.PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var lesson = await db.LearningLessons.SingleOrDefaultAsync(value => value.Id == lessonId, ct);
        if (lesson is null) return Results.NotFound();
        if (!(await LearningPolicy.Levels(personId, db, ct)).Any(value => value.UnitId == lesson.UnitId && value.CanManage)) return Results.Problem(statusCode: 403);
        if (request.Version != lesson.Version) return Results.Conflict(new { error = "This learning point has changed. Reload before saving." });
        var plan = request.ActionPlan?.Trim() ?? "";
        var note = request.TreatmentNote?.Trim() ?? "";
        if (request.Status is not ("new" or "in_progress" or "implemented" or "dismissed") || request.Priority is not ("high" or "normal" or "low") ||
            plan.Length > 2000 || note.Length > 4000 || request.Status == "in_progress" && (plan.Length < 2 || request.DueOn == null) ||
            (request.Status is "implemented" or "dismissed") && note.Length < 2 ||
            (lesson.Status is "implemented" or "dismissed") && (request.Status is "new" or "in_progress") && (note.Length < 2 || note == lesson.TreatmentNote))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["review"] = ["Select a valid status and priority. Work in progress needs an action plan and deadline; closure or reopening needs a rationale."] });
        var now = DateTimeOffset.UtcNow;
        var author = await db.People.Where(value => value.Id == personId).Select(value => value.DisplayName).SingleAsync(ct);
        lesson.Review(request.Status!, request.Priority!, plan, note, request.DueOn, personId, author, now);
        db.LearningEntries.Add(new LearningEntry(Guid.NewGuid(), lesson.SiteId, lesson.Id, personId, author, "review", note, now, lesson.Status, lesson.Priority, plan, lesson.DueOn));
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), lesson.SiteId, personId, "learning.reviewed", "work-item", lesson.WorkItemId, now), "learning.updated", resourceType: "learning", resourceId: lesson.Id, metadataJson: System.Text.Json.JsonSerializer.Serialize(new { revision = lesson.Version, status = lesson.Status }));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }
    private sealed record CommentRequest(string? Text);
    private sealed record ReviewRequest(long Version, string? Status, string? Priority, string? ActionPlan, string? TreatmentNote, DateOnly? DueOn);
}
