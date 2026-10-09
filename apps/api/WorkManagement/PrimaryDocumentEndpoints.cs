using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class PrimaryDocumentEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/primary-document", Import)
            .RequireRateLimiting("bounded-upload")
            .WithMetadata(new RequestSizeLimitAttribute(PrimaryDocumentExtractor.MaximumBytes + 64 * 1024),
                new RequestFormLimitsAttribute { MultipartBodyLengthLimit = PrimaryDocumentExtractor.MaximumBytes + 64 * 1024 });
        group.MapGet("/sites/{siteId:guid}/items/{itemId:guid}/primary-document", Get);
    }

    private static async Task<IResult> Import(Guid siteId, Guid itemId, HttpRequest request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!WorkItemPolicy.PersonId(user, out var actor)) return Results.Problem(statusCode: 403);
        var item = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == itemId && value.SiteId == siteId, ct);
        if (item is null) return Results.NotFound();
        var visibleItems = await WorkItemVisibility.QueryForPerson(siteId, actor, DateTimeOffset.UtcNow, db, ct);
        if (!await visibleItems.AnyAsync(value => value.Id == itemId, ct)) return Results.NotFound();
        if (!await CanImport(item, actor, db, ct)) return Results.Problem(statusCode: 403);
        if (await IsLocked(item.Id, db, ct))
            return Results.Conflict(new { code = "work_item_content_locked", error = "The task is locked or archived." });
        if (!request.HasFormContentType) return Validation("document", "Choose a PDF, DOCX or plain-text document.");
        var form = await request.ReadFormAsync(ct);
        var file = form.Files.GetFile("document");
        if (file is null) return Validation("document", "Choose a PDF, DOCX or plain-text document.");
        var availableToAi = !string.Equals(form["availableToAi"], "false", StringComparison.OrdinalIgnoreCase);
        PrimaryDocumentExtractor.Result extracted;
        try { extracted = await PrimaryDocumentExtractor.Extract(file, ct); }
        catch (InvalidDataException)
        {
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, "work-item.primary-document-rejected", "work-item", itemId, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(ct);
            return Validation("document", "The document could not be safely imported. Use a passive PDF, DOCX or UTF-8 text file up to 8 MiB and 100,000 extracted characters.");
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, "work-item.primary-document-rejected", "work-item", itemId, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(ct);
            return Validation("document", "The document is damaged, encrypted or unsupported and was not imported.");
        }
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        _ = await db.WorkItems.FromSqlInterpolated($"SELECT * FROM work_items WHERE id = {itemId} FOR UPDATE").SingleAsync(ct);
        var version = await db.PrimaryDocumentSnapshots.Where(value => value.WorkItemId == itemId).Select(value => (int?)value.Version).MaxAsync(ct) ?? 0;
        var snapshot = new PrimaryDocumentSnapshot(Guid.NewGuid(), siteId, itemId, version + 1, extracted.Name,
            extracted.MediaType, extracted.Sha256, item.ReferenceUrl, extracted.Text, extracted.StructuredContent, availableToAi, actor, DateTimeOffset.UtcNow);
        db.PrimaryDocumentSnapshots.Add(snapshot);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, "work-item.primary-document-imported", "primary-document-snapshot", snapshot.Id, snapshot.CreatedAt));
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
        return Results.Ok(Response(snapshot, extracted.BlockCount, true));
    }

    private static async Task<IResult> Get(Guid siteId, Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!WorkItemPolicy.PersonId(user, out var actor)) return Results.Problem(statusCode: 403);
        var visibleItems = await WorkItemVisibility.QueryForPerson(siteId, actor, DateTimeOffset.UtcNow, db, ct);
        var visible = await visibleItems.AnyAsync(value => value.Id == itemId, ct);
        if (!visible) return Results.NotFound();
        var item = await db.WorkItems.AsNoTracking().SingleAsync(value => value.Id == itemId && value.SiteId == siteId, ct);
        var canImport = await CanImport(item, actor, db, ct) && !await IsLocked(item.Id, db, ct);
        var value = await db.PrimaryDocumentSnapshots.AsNoTracking().Where(snapshot => snapshot.WorkItemId == itemId)
            .OrderByDescending(snapshot => snapshot.Version).Select(snapshot => new { snapshot.Id, snapshot.Name, snapshot.MediaType, snapshot.Sha256, snapshot.SourceUrl, snapshot.Version, snapshot.AvailableToAi, snapshot.CreatedAt }).FirstOrDefaultAsync(ct);
        if (value is null) return Results.Ok(value);
        return Results.Ok(new { value.Id, value.Name, value.MediaType, value.Sha256, value.SourceUrl, value.Version, value.AvailableToAi, value.CreatedAt, canImport });
    }
    private static async Task<bool> CanImport(WorkItem item, Guid actor, FylkrenDbContext db, CancellationToken ct)
    {
        if (item.CreatedByPersonId == actor) return true;
        if (await db.WorkflowRuns.AnyAsync(run => run.WorkItemId == item.Id && run.Definition.Kind == "planning" &&
            run.Status == "in_progress" && run.ClaimedByPersonId == actor, ct)) return true;
        return await WorkItemPolicy.CanManageItem(item, actor, db, ct);
    }
    private static Task<bool> IsLocked(Guid itemId, FylkrenDbContext db, CancellationToken ct) =>
        db.InformationLifecycles.AnyAsync(value => value.ResourceType == "work_item" && value.ResourceId == itemId && value.Stage != "active", ct);
    private static object Response(PrimaryDocumentSnapshot value, int blocks, bool canImport) => new { value.Id, value.Name, value.MediaType, value.Sha256, value.SourceUrl, value.Version, value.AvailableToAi, value.CreatedAt, blocks, characters = value.ExtractedText.Length, canImport };
    private static IResult Validation(string key, string message) => Results.ValidationProblem(new Dictionary<string, string[]> { [key] = [message] });
}
