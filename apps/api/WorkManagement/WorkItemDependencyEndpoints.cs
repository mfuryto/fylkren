using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemDependencyEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/items/{itemId:guid}/dependencies", GetDependencies);
        group.MapGet("/sites/{siteId:guid}/items/{itemId:guid}/dependency-candidates", GetCandidates);
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/dependencies", AddDependency);
        group.MapDelete("/sites/{siteId:guid}/items/{itemId:guid}/dependencies/{dependencyId:guid}", RemoveDependency);
    }

    internal static Task<bool> IsBlocked(Guid itemId, FylkrenDbContext db, CancellationToken ct) =>
        db.WorkItemDependencies.AnyAsync(value =>
            value.DependentWorkItemId == itemId && value.PredecessorWorkItem.Status != "completed", ct);

    private static async Task<IResult> GetDependencies(Guid siteId, Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId) || !await CanRead(siteId, itemId, personId, db, ct))
            return Results.Problem(statusCode: 403);

        var values = await db.WorkItemDependencies.AsNoTracking()
            .Where(value => value.SiteId == siteId && value.DependentWorkItemId == itemId)
            .OrderBy(value => value.PredecessorWorkItem.Title)
            .Select(value => new WorkItemDependencySummary(
                value.Id,
                value.Type,
                value.PredecessorWorkItemId,
                value.PredecessorWorkItem.Title,
                value.PredecessorWorkItem.Status,
                value.PredecessorWorkItem.Status == "completed",
                value.CreatedAt))
            .ToListAsync(ct);
        return Results.Ok(values);
    }

    private static async Task<IResult> GetCandidates(Guid siteId, Guid itemId, string? search, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var dependent = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == itemId && value.SiteId == siteId, ct);
        if (dependent is null) return Results.NotFound();
        if (!await CanManageItem(dependent, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (dependent.Status is "completed" or "cancelled" or "rejected" or "reassigned")
            return Results.Conflict(new { error = "Dependencies cannot be changed on a closed task." });
        if (dependent.Status == "registered")
            return Results.Conflict(new { error = "Move the task to review before registering dependencies." });
        if (dependent.Status is "planning" or "execution" or "in_review")
            return Results.Conflict(new { error = "Put the task on hold before registering dependencies." });

        var term = (search ?? string.Empty).Trim().ToLower();
        if (term.Length < 2) return Results.Ok(Array.Empty<object>());
        var existing = db.WorkItemDependencies.Where(value => value.DependentWorkItemId == itemId).Select(value => value.PredecessorWorkItemId);
        var visible = await WorkItemVisibility.QueryForPerson(siteId, personId, DateTimeOffset.UtcNow, db, ct);
        var visibleIds = visible.Select(value => value.Id);
        var values = await db.WorkItems.AsNoTracking()
            .Where(value => value.SiteId == siteId && visibleIds.Contains(value.Id) && value.Id != itemId && !existing.Contains(value.Id) && value.Title.ToLower().Contains(term))
            .OrderByDescending(value => value.CreatedAt)
            .Take(20)
            .Select(value => new { value.Id, value.Title, value.Status, value.CreatedAt })
            .ToListAsync(ct);
        return Results.Ok(values);
    }

    private static async Task<IResult> AddDependency(Guid siteId, Guid itemId, CreateDependencyRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var dependent = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == itemId && value.SiteId == siteId, ct);
        if (dependent is null) return Results.NotFound();
        if (!await CanManageItem(dependent, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (dependent.Status is "completed" or "cancelled" or "rejected" or "reassigned")
            return Results.Conflict(new { error = "Dependencies cannot be changed on a closed task." });
        if (dependent.Status == "registered")
            return Results.Conflict(new { error = "Move the task to review before registering dependencies." });
        if (dependent.Status is "planning" or "execution" or "in_review")
            return Results.Conflict(new { error = "Put the task on hold before registering dependencies." });
        var type = string.IsNullOrWhiteSpace(request.Type) ? WorkItemDependency.FinishToStart : request.Type.Trim().ToLowerInvariant();
        if (type != WorkItemDependency.FinishToStart)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["type"] = ["Only finish-to-start dependencies are currently supported."] });
        if (request.PredecessorWorkItemId == itemId)
            return Results.Conflict(new { error = "A task cannot depend on itself." });
        var visible = await WorkItemVisibility.QueryForPerson(siteId, personId, DateTimeOffset.UtcNow, db, ct);
        if (!await visible.AnyAsync(value => value.Id == request.PredecessorWorkItemId && value.SiteId == siteId, ct))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["predecessorWorkItemId"] = ["Select an existing task in the same site."] });
        if (await db.WorkItemDependencies.AnyAsync(value => value.DependentWorkItemId == itemId && value.PredecessorWorkItemId == request.PredecessorWorkItemId && value.Type == type, ct))
            return Results.Conflict(new { error = "This dependency already exists." });
        if (await WouldCreateCycle(siteId, request.PredecessorWorkItemId, itemId, db, ct))
            return Results.Conflict(new { error = "The dependency cannot be created because it would create a cycle between tasks." });

        var now = DateTimeOffset.UtcNow;
        var dependency = new WorkItemDependency(Guid.NewGuid(), siteId, request.PredecessorWorkItemId, itemId, type, personId, now);
        db.WorkItemDependencies.Add(dependency);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.dependency-added", "work-item-dependency", dependency.Id, now));
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/sites/{siteId}/items/{itemId}/dependencies/{dependency.Id}", new { dependency.Id });
    }

    private static async Task<IResult> RemoveDependency(Guid siteId, Guid itemId, Guid dependencyId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var dependent = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == itemId && value.SiteId == siteId, ct);
        if (dependent is null) return Results.NotFound();
        if (!await CanManageItem(dependent, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (dependent.Status is "completed" or "cancelled" or "rejected" or "reassigned")
            return Results.Conflict(new { error = "Dependencies cannot be changed on a closed task." });
        var dependency = await db.WorkItemDependencies.SingleOrDefaultAsync(value => value.Id == dependencyId && value.SiteId == siteId && value.DependentWorkItemId == itemId, ct);
        if (dependency is null) return Results.NotFound();
        db.WorkItemDependencies.Remove(dependency);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.dependency-removed", "work-item-dependency", dependency.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<bool> WouldCreateCycle(Guid siteId, Guid predecessorId, Guid dependentId, FylkrenDbContext db, CancellationToken ct)
    {
        var edges = await db.WorkItemDependencies.AsNoTracking()
            .Where(value => value.SiteId == siteId)
            .Select(value => new { value.PredecessorWorkItemId, value.DependentWorkItemId })
            .ToListAsync(ct);
        var queue = new Queue<Guid>();
        var visited = new HashSet<Guid>();
        queue.Enqueue(dependentId);
        while (queue.TryDequeue(out var current))
        {
            if (!visited.Add(current)) continue;
            if (current == predecessorId) return true;
            foreach (var next in edges.Where(edge => edge.PredecessorWorkItemId == current).Select(edge => edge.DependentWorkItemId))
                queue.Enqueue(next);
        }
        return false;
    }

    private static async Task<bool> CanRead(Guid siteId, Guid itemId, Guid personId, FylkrenDbContext db, CancellationToken ct) =>
        await IsMember(siteId, personId, db, ct) &&
        (await LeadsSiteRoot(siteId, personId, db, ct) || await CanReadWorkTree(siteId, itemId, personId, db, ct));
}
