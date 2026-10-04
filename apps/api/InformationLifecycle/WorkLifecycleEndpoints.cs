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
        var blocked = await WorkLifecyclePolicy.Blockers(item, db, record?.Stage == "closed", ct);
        return Results.Ok(new { automatic = true, automationPaused = record?.AutomationPaused ?? false, terminal = WorkLifecyclePolicy.Terminal(item.Status), impact = new { eligible = blocked.Count == 0, blockers = blocked }, stage = record?.Stage ?? "active", effectiveStage = inherited?.Stage ?? record?.Stage ?? "active", inheritedLock = inherited != null, version = record?.Version ?? 0, held = record?.IsHeld == true || blocked.ContainsKey("inherited_preservation"), irreversibleEnabled = false });
    }
    private sealed record TransitionRequest(string Stage, long ExpectedVersion, string Reason);
    private static async Task<IResult> Transition(Guid siteId, Guid itemId, TransitionRequest request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var person) || !await IsMember(siteId, person, db, ct)) return Results.Problem(statusCode: 403);
        if (request.Stage is not ("active" or "closed" or "archived") || string.IsNullOrWhiteSpace(request.Reason) || request.Reason.Length > 1000 || request.Reason.Any(char.IsControl)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Sites.FromSqlInterpolated($"SELECT * FROM sites WHERE id={siteId} FOR SHARE").AsNoTracking().ToListAsync(ct);
        var ancestorIds = await db.Database.SqlQuery<Guid>($$"""
            WITH RECURSIVE chain AS (SELECT id,parent_work_item_id,site_id FROM work_items WHERE id={{itemId}} AND site_id={{siteId}}
             UNION SELECT w.id,w.parent_work_item_id,w.site_id FROM work_items w JOIN chain c ON w.id=c.parent_work_item_id AND w.site_id=c.site_id)
            SELECT w.id AS "Value" FROM work_items w JOIN chain c ON c.id=w.id ORDER BY w.id FOR UPDATE OF w
            """).ToArrayAsync(ct);
        var item = await db.WorkItems.FromSqlInterpolated($"SELECT *, xmin FROM work_items WHERE id = {itemId} AND site_id = {siteId} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (item is null) return Results.NotFound();
        if (!await CanManageItem(item, person, db, ct)) return Results.Problem(statusCode: 403);
        if (await db.InformationLifecycles.AnyAsync(l => l.OwnerSiteId == siteId &&
            (l.ResourceType == "site" && (l.IsHeld || l.Stage != "active") || l.ResourceType == "work_item" && l.ResourceId != itemId && ancestorIds.Contains(l.ResourceId) && (l.IsHeld || l.Stage != "active")), ct))
            return Results.Conflict(new { code = "information_locked" });
        if (!await WorkLifecycleAutomation.LockDependents(itemId, db, ct)) return Results.Conflict(new { code = "lifecycle_transition_conflict" });
        var record = await db.InformationLifecycles.SingleOrDefaultAsync(x => x.OwnerSiteId == siteId && x.ResourceType == "work_item" && x.ResourceId == itemId, ct);
        if ((record?.Version ?? 0) != request.ExpectedVersion) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        if (request.Stage is "closed" or "archived" && (await WorkLifecyclePolicy.Blockers(item, db, request.Stage == "archived", ct)).Count > 0) return Results.Conflict(new { code = "lifecycle_unfinished_relationships" });
        if (record is null) { record = new(Guid.NewGuid(), siteId, "work_item", itemId, itemId, DateTimeOffset.UtcNow); db.InformationLifecycles.Add(record); }
        var previousStage = record.Stage;
        try
        {
            if (record.Stage == "archived" && request.Stage == "active") record.Transition("closed", record.Version, request.Reason, DateTimeOffset.UtcNow);
            record.Transition(request.Stage, record.Version, request.Reason, DateTimeOffset.UtcNow);
            record.SetAutomationPaused(request.Stage == "active" || previousStage == "archived" && request.Stage == "closed");
        }
        catch (InvalidOperationException) { return Results.Conflict(new { code = "lifecycle_transition_conflict" }); }
        var type = request.Stage == "archived" ? "information.archived" : request.Stage == "closed" && previousStage == "active" ? "information.closed" : "information.restored";
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, person, type, "work-item", itemId, DateTimeOffset.UtcNow).WithReason(request.Reason), type, metadataJson: System.Text.Json.JsonSerializer.Serialize(new { status = record.Stage, previousStatus = previousStage }));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return Results.Ok(new { record.Stage, record.Version, record.AutomationPaused, automatic = true });
    }
    internal static async Task<bool> Eligible(WorkItem item, FylkrenDbContext db, CancellationToken ct) =>
        (await WorkLifecyclePolicy.Blockers(item, db, true, ct)).Count == 0;
}
