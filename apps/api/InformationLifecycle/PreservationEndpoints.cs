using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal static class PreservationEndpoints
{
    internal static void MapPreservationEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/information/preservation").RequireAuthorization(p => p.RequireRole("PlatformManager"));
        group.MapGet("/policies", async (FylkrenDbContext db, CancellationToken ct) => Results.Ok(await db.RetentionPolicyVersions.AsNoTracking().OrderByDescending(p => p.CreatedAt).Take(100).ToListAsync(ct)));
        group.MapPost("/policies", CreatePolicy);
        group.MapGet("/{kind}/{id:guid}", Read);
        group.MapPost("/{kind}/{id:guid}/holds", AddHold);
        group.MapPost("/{kind}/{id:guid}/holds/{holdId:guid}/release", ReleaseHold);
        group.MapPost("/{kind}/{id:guid}/policy", BindPolicy);
    }
    private static async Task<bool> Exists(string kind, Guid id, FylkrenDbContext db, CancellationToken ct) => kind switch
    {
        "site" => await db.Sites.AnyAsync(s => s.Id == id, ct),
        "person" => await db.People.AnyAsync(p => p.Id == id, ct),
        "work_item" => await db.WorkItems.AnyAsync(w => w.Id == id, ct),
        _ => false
    };
    private static async Task<IResult> Read(string kind, Guid id, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await Exists(kind, id, db, ct)) return Results.NotFound();
        var record = await db.InformationLifecycles.AsNoTracking().SingleOrDefaultAsync(l => l.ResourceType == kind && l.ResourceId == id, ct);
        var holds = record is null ? [] : await db.LifecycleHolds.AsNoTracking().Where(h => h.LifecycleId == record.Id).OrderBy(h => h.CreatedAt).ToListAsync(ct);
        return Results.Ok(new { version = record?.Version ?? 0, held = record?.IsHeld ?? false, record?.PolicyId, record?.PolicyVersion, holds, irreversibleEnabled = false, automaticRetentionEnabled = false });
    }
    private static async Task<InformationLifecycleRecord?> Lock(string kind, Guid id, FylkrenDbContext db, CancellationToken ct)
    {
        if (kind != "work_item") return await GovernanceLifecycleEndpoints.LockRoot(kind, id, db, ct);
        // Match housekeeping/whole-Site transition lock ordering.
        await db.Sites.FromSqlInterpolated($"SELECT s.* FROM sites s JOIN work_items w ON w.site_id=s.id WHERE w.id={id} FOR SHARE OF s").AsNoTracking().ToListAsync(ct);
        var item = await db.WorkItems.FromSqlInterpolated($"SELECT *, xmin FROM work_items WHERE id = {id} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (item is null) return null;
        var record = await db.InformationLifecycles.SingleOrDefaultAsync(l => l.ResourceType == kind && l.ResourceId == id && l.OwnerSiteId == item.SiteId, ct);
        if (record is null) { record = new(Guid.NewGuid(), item.SiteId, kind, id, id, DateTimeOffset.UtcNow); db.InformationLifecycles.Add(record); }
        return record;
    }
    private static bool Current(InformationLifecycleRecord record, long expected, FylkrenDbContext db) => (db.Entry(record).State == EntityState.Added ? 0 : record.Version) == expected;
    private static async Task<Guid?> Actor(ClaimsPrincipal user, HttpContext context, IAntiforgery csrf) => await csrf.IsRequestValidAsync(context) && Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor) ? actor : null;
    private static void Audit(FylkrenDbContext db, InformationLifecycleRecord root, Guid actor, string action, Guid resource, string reason) => db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), root.OwnerSiteId, actor, action, "information-preservation", resource, DateTimeOffset.UtcNow).WithReason(reason));
    private sealed record HoldRequest(long ExpectedVersion, string Reason);
    private static async Task<IResult> AddHold(string kind, Guid id, HoldRequest request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        var actor = await Actor(user, context, csrf); if (actor is null || !GovernanceLifecycleEndpoints.Reason(request.Reason)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct); var root = await Lock(kind, id, db, ct); if (root is null) return Results.NotFound();
        if (!Current(root, request.ExpectedVersion, db)) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        if (root.IsHeld && !await db.LifecycleHolds.AnyAsync(h => h.LifecycleId == root.Id && h.ReleasedAt == null, ct)) return Results.Conflict(new { code = "preservation_hold_unreconciled" });
        var hold = new LifecycleHold(Guid.NewGuid(), root.Id, actor.Value, request.Reason, DateTimeOffset.UtcNow); db.LifecycleHolds.Add(hold);
        root.SetHold(true, root.Version, request.Reason, DateTimeOffset.UtcNow); Audit(db, root, actor.Value, "information.hold-added", hold.Id, request.Reason);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { root.Version, root.IsHeld, hold.Id });
    }
    private static async Task<IResult> ReleaseHold(string kind, Guid id, Guid holdId, HoldRequest request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        var actor = await Actor(user, context, csrf); if (actor is null || !GovernanceLifecycleEndpoints.Reason(request.Reason)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct); var root = await Lock(kind, id, db, ct); if (root is null) return Results.NotFound();
        if (!Current(root, request.ExpectedVersion, db)) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        var hold = await db.LifecycleHolds.SingleOrDefaultAsync(h => h.Id == holdId && h.LifecycleId == root.Id && h.ReleasedAt == null, ct); if (hold is null) return Results.NotFound();
        hold.Release(actor.Value, request.Reason, DateTimeOffset.UtcNow);
        var remaining = await db.LifecycleHolds.AnyAsync(h => h.LifecycleId == root.Id && h.Id != holdId && h.ReleasedAt == null, ct);
        root.SetHold(remaining, root.Version, request.Reason, DateTimeOffset.UtcNow); Audit(db, root, actor.Value, "information.hold-released", hold.Id, request.Reason);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { root.Version, root.IsHeld });
    }
    private sealed record BindingRequest(Guid PolicyId, int PolicyVersion, long ExpectedVersion, string Reason);
    private static async Task<IResult> BindPolicy(string kind, Guid id, BindingRequest request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        var actor = await Actor(user, context, csrf); if (actor is null || !GovernanceLifecycleEndpoints.Reason(request.Reason)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct); var root = await Lock(kind, id, db, ct); if (root is null) return Results.NotFound();
        if (!Current(root, request.ExpectedVersion, db)) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        if (!await db.RetentionPolicyVersions.AnyAsync(p => p.PolicyId == request.PolicyId && p.Version == request.PolicyVersion && p.Category == "content", ct)) return Results.BadRequest();
        root.BindPolicy(request.PolicyId, request.PolicyVersion, root.Version, request.Reason, DateTimeOffset.UtcNow); Audit(db, root, actor.Value, "information.policy-bound", root.Id, request.Reason);
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { root.Version, root.PolicyId, root.PolicyVersion });
    }
    private sealed record PolicyRequest(Guid? PolicyId, int ExpectedVersion, string Name, string Category, int? ReviewAfterDays, string Reason);
    private static async Task<IResult> CreatePolicy(PolicyRequest request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        var actor = await Actor(user, context, csrf); if (actor is null || !GovernanceLifecycleEndpoints.Reason(request.Reason) || request.PolicyId == Guid.Empty) return Results.BadRequest();
        var id = request.PolicyId ?? Guid.NewGuid(); await using var tx = await db.Database.BeginTransactionAsync(ct);
        await db.Database.ExecuteSqlInterpolatedAsync($"SELECT pg_advisory_xact_lock(hashtextextended({"preservation-policy:" + id.ToString()}, 0))", ct);
        var latest = await db.RetentionPolicyVersions.Where(p => p.PolicyId == id).OrderByDescending(p => p.Version).FirstOrDefaultAsync(ct);
        if ((latest?.Version ?? 0) != request.ExpectedVersion || request.ExpectedVersion >= 1000 || latest is not null && latest.Category != request.Category) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        RetentionPolicyVersion policy;
        try { policy = new(id, request.ExpectedVersion + 1, request.Name, request.Category, request.ReviewAfterDays, actor.Value, DateTimeOffset.UtcNow); }
        catch (ArgumentException) { return Results.BadRequest(); }
        db.RetentionPolicyVersions.Add(policy); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor.Value, "information.policy-created", "retention-policy", id, DateTimeOffset.UtcNow).WithReason(request.Reason));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(policy);
    }
}
