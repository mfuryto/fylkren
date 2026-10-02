using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Learning;

internal sealed record LessonDraft(Guid Id, string? Kind, string? Text);

internal static class LearningCreation
{
    internal static async Task<IResult?> AddDrafts(IReadOnlyList<LessonDraft>? drafts, WorkItem item, Guid personId, FylkrenDbContext db, DateTimeOffset now, CancellationToken ct)
    {
        if (drafts is null || drafts.Count == 0) return null;
        if (drafts.Count > 50 || drafts.Select(value => value.Id).Distinct().Count() != drafts.Count ||
            drafts.Any(value => value.Id == Guid.Empty || value.Kind is not ("positive" or "improvement") || (value.Text?.Trim().Length ?? 0) is < 2 or > 4000))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["lessons"] = ["Add up to 50 distinct learning points, with a category and 2–4,000 characters each."] });
        var ids = drafts.Select(value => value.Id).ToArray();
        var existing = await db.LearningLessons.Where(value => ids.Contains(value.Id)).ToListAsync(ct);
        if (existing.Any(value => value.WorkItemId != item.Id || drafts.Any(draft => draft.Id == value.Id && (draft.Kind != value.Kind || draft.Text!.Trim() != value.Text))))
            return Results.Conflict(new { error = "A learning point identifier is already in use. Reload before adding points." });
        var fresh = drafts.Where(value => existing.All(saved => saved.Id != value.Id)).ToArray();
        if (fresh.Length == 0) return null;
        var number = await db.LearningLessons.Where(value => value.WorkItemId == item.Id).Select(value => (int?)value.Number).MaxAsync(ct) ?? 0;
        if (number + fresh.Length > 100) return Results.Conflict(new { error = "This task already has the maximum of 100 learning points." });
        var unitId = await WorkLevelAuthorization.ResolveLevelId(item.SiteId, item.AssignedUnitId, db, ct);
        if (unitId is null) return Results.Conflict(new { error = "The work level is no longer active." });
        var author = await db.People.Where(value => value.Id == personId).Select(value => value.DisplayName).SingleAsync(ct);
        foreach (var draft in fresh)
        {
            db.LearningLessons.Add(new LearningLesson(draft.Id, item.SiteId, item.Id, unitId.Value, ++number, draft.Kind!, draft.Text!.Trim(), personId, author, now));
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), item.SiteId, personId, "learning.created", "work-item", item.Id, now));
        }
        return null;
    }
}
