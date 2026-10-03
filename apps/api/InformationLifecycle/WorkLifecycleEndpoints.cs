using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.InformationLifecycle;

internal static class WorkLifecycleEndpoints
{
    internal static void MapWorkLifecycleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/information/sites/{siteId:guid}/work-items/{itemId:guid}").RequireAuthorization();
        group.MapGet("", Read);
        group.MapPost("/transitions", Transition);
    }
    private static async Task<IResult> Read(Guid siteId, Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var person) || !await IsMember(siteId, person, db, ct)) return Results.Problem(statusCode: 403);
        var item = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
        if (item is null || !await CanManageItem(item, person, db, ct) && !await CanReadWorkTree(siteId, itemId, person, db, ct)) return Results.Problem(statusCode: 403);
        var record = await db.InformationLifecycles.AsNoTracking().SingleOrDefaultAsync(x => x.OwnerSiteId == siteId && x.ResourceType == "work_item" && x.ResourceId == itemId, ct);
        var inherited = await db.InformationLifecycles.FromSqlInterpolated($"WITH RECURSIVE chain AS (SELECT id, parent_work_item_id FROM work_items WHERE id = {itemId} AND site_id = {siteId} UNION SELECT w.id, w.parent_work_item_id FROM work_items w JOIN chain c ON w.id = c.parent_work_item_id WHERE w.site_id = {siteId}) SELECT l.* FROM information_lifecycle l WHERE l.owner_site_id = {siteId} AND l.stage <> 'active' AND (l.resource_type = 'site' AND l.resource_id = {siteId} OR l.resource_type = 'work_item' AND l.resource_id <> {itemId} AND l.resource_id IN (SELECT id FROM chain)) ORDER BY CASE l.stage WHEN 'archived' THEN 0 ELSE 1 END LIMIT 1").AsNoTracking().SingleOrDefaultAsync(ct);
        return Results.Ok(new { stage = record?.Stage ?? "active", effectiveStage = inherited?.Stage ?? record?.Stage ?? "active", inheritedLock = inherited != null, version = record?.Version ?? 0, held = record?.IsHeld ?? false, irreversibleEnabled = false });
    }
    private sealed record TransitionRequest(string Stage, long ExpectedVersion, string Reason);
    private static async Task<IResult> Transition(Guid siteId, Guid itemId, TransitionRequest request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var person) || !await IsMember(siteId, person, db, ct)) return Results.Problem(statusCode: 403);
        if (request.Stage is not ("active" or "closed" or "archived") || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 1000 || request.Reason.Any(char.IsControl)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var item = await db.WorkItems.FromSqlInterpolated($"SELECT *, xmin FROM work_items WHERE id = {itemId} AND site_id = {siteId} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (item is null) return Results.NotFound();
        if (!await CanManageItem(item, person, db, ct)) return Results.Problem(statusCode: 403);
        var record = await db.InformationLifecycles.SingleOrDefaultAsync(x => x.OwnerSiteId == siteId && x.ResourceType == "work_item" && x.ResourceId == itemId, ct);
        if ((record?.Version ?? 0) != request.ExpectedVersion) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        if (request.Stage is "closed" or "archived" && !await Eligible(item, db, ct)) return Results.Conflict(new { code = "lifecycle_unfinished_relationships" });
        if (record is null) { record = new(Guid.NewGuid(), siteId, "work_item", itemId, itemId, DateTimeOffset.UtcNow); db.InformationLifecycles.Add(record); }
        var previousStage = record.Stage;
        try { record.Transition(request.Stage, record.Version, request.Reason, DateTimeOffset.UtcNow); }
        catch (InvalidOperationException) { return Results.Conflict(new { code = "lifecycle_transition_conflict" }); }
        var type = request.Stage == "archived" ? "information.archived" : request.Stage == "closed" && previousStage == "active" ? "information.closed" : "information.restored";
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, person, type, "work-item", itemId, DateTimeOffset.UtcNow), type, metadataJson: System.Text.Json.JsonSerializer.Serialize(new { status = record.Stage, previousStatus = previousStage }));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return Results.Ok(new { record.Stage, record.Version });
    }
    internal static async Task<bool> Eligible(WorkItem item, FylkrenDbContext db, CancellationToken ct)
    {
        if (item.Status is not ("completed" or "cancelled" or "rejected" or "reassigned") || item.Status == "completed" && item.FinalReportApprovedAt is null) return false;
        // Another site's internal work/learning is independently owned. Our own
        // tracking work and pending transport remain the cross-site closure gates.
        var descendants = await db.WorkItems.FromSqlInterpolated($"WITH RECURSIVE tree AS (SELECT id FROM work_items WHERE id = {item.Id} UNION SELECT w.id FROM work_items w JOIN tree t ON w.parent_work_item_id = t.id WHERE w.site_id = {item.SiteId}) SELECT w.*, w.xmin FROM work_items w JOIN tree t ON w.id = t.id").AsNoTracking().ToListAsync(ct);
        var ids = descendants.Select(x => x.Id).ToArray();
        if (descendants.Any(x => x.Status is not ("completed" or "cancelled" or "rejected" or "reassigned"))) return false;
        if (await db.LearningLessons.AnyAsync(x => ids.Contains(x.WorkItemId) && (x.Status == "new" || x.Status == "in_progress"), ct)) return false;
        if (await db.WorkflowRuns.AnyAsync(x => ids.Contains(x.WorkItemId) && x.Status != "approved" && x.Status != "rejected" && x.Status != "cancelled", ct)) return false;
        if (await db.ExecutionRuns.AnyAsync(x => ids.Contains(x.WorkItemId) && x.Status != "submitted" && x.Status != "cancelled", ct)) return false;
        if (await db.NotificationOutboxMessages.AnyAsync(x => ids.Contains(x.WorkItemId) && x.Status == "pending", ct)) return false;
        if (await db.EventProjections.AnyAsync(x => x.Status != "completed" && x.Status != "skipped" && db.DomainEvents.Any(e => e.Id == x.DomainEventId && e.ContextWorkItemId != null && ids.Contains(e.ContextWorkItemId.Value)), ct)) return false;
        if (await db.WebhookDeliveries.AnyAsync(x => x.Status != "succeeded" && x.Status != "failed" && x.DomainEvent.ContextWorkItemId != null && ids.Contains(x.DomainEvent.ContextWorkItemId.Value), ct)) return false;
        // Protocol records are kept; queued transport blocks archival rather than being cancelled.
        if (await db.FederationOutboundMessages.AnyAsync(x => (ids.Contains(x.OriginResourceId) || db.FederationWorkLinks.Any(link => ids.Contains(link.LocalWorkItemId) && link.OriginResourceId == x.OriginResourceId && link.OriginInstanceId == x.OriginInstanceId && link.PeerInstanceId == x.PeerInstanceId)) && (x.Status == "pending" || x.Status == "retrying"), ct)) return false;
        if (await db.Risks.AnyAsync(x => (ids.Contains(x.ObjectId) && (x.ObjectType == "task" || x.ObjectType == "assignment") ||
            x.ObjectType == "plan" && db.WorkflowRuns.Any(run => run.Id == x.ObjectId && ids.Contains(run.WorkItemId)) ||
            x.ObjectType == "execution" && db.ExecutionRuns.Any(run => run.Id == x.ObjectId && ids.Contains(run.WorkItemId))) &&
            x.Revisions.OrderByDescending(r => r.Version).Select(r => r.Status).FirstOrDefault() != "closed", ct)) return false;
        return true;
    }
}
