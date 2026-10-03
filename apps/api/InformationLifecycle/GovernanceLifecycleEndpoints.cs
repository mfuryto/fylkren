using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.InformationLifecycle;

internal static class GovernanceLifecycleEndpoints
{
    internal static void MapGovernanceLifecycleEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/information/governance").RequireAuthorization(p => p.RequireRole("PlatformManager"));
        group.MapGet("/{kind}/{id:guid}", Read);
        group.MapPost("/{kind}/{id:guid}/transitions", Transition);
        group.MapGet("/sites/{siteId:guid}/custodians", async (Guid siteId, FylkrenDbContext db, CancellationToken ct) =>
            Results.Ok(await db.ArchiveGrants.AsNoTracking().Where(g => g.SiteId == siteId).OrderBy(g => g.CreatedAt).Select(g => new { g.Id, g.PersonId, g.SiteId, g.CanExport, g.IsActive, g.Version, name = db.People.Where(p => p.Id == g.PersonId).Select(p => p.DisplayName).FirstOrDefault() }).ToListAsync(ct)));
        group.MapPost("/sites/{siteId:guid}/custodians", Grant);
        group.MapPost("/sites/{siteId:guid}/custodians/{grantId:guid}/revoke", Revoke);
    }
    internal static async Task<InformationLifecycleRecord?> LockRoot(string kind, Guid id, FylkrenDbContext db, CancellationToken ct)
    {
        if (kind == "site") { if (await db.Sites.FromSqlInterpolated($"SELECT * FROM sites WHERE id = {id} FOR UPDATE").SingleOrDefaultAsync(ct) is null) return null; }
        else if (kind == "person") { if (await db.People.FromSqlInterpolated($"SELECT * FROM people WHERE id = {id} FOR UPDATE").SingleOrDefaultAsync(ct) is null) return null; }
        else return null;
        var record = await db.InformationLifecycles.FromSqlInterpolated($"SELECT * FROM information_lifecycle WHERE resource_type = {kind} AND resource_id = {id} AND (owner_site_id = {id} OR owner_site_id IS NULL) FOR UPDATE").SingleOrDefaultAsync(ct);
        if (record is null) { record = new(Guid.NewGuid(), kind == "site" ? id : null, kind, id, null, DateTimeOffset.UtcNow); db.InformationLifecycles.Add(record); }
        return record;
    }
    private static async Task<IResult> Read(string kind, Guid id, FylkrenDbContext db, CancellationToken ct)
    {
        if (kind is not ("site" or "person")) return Results.NotFound();
        if (kind == "site" ? !await db.Sites.AnyAsync(s => s.Id == id, ct) : !await db.People.AnyAsync(p => p.Id == id, ct)) return Results.NotFound();
        var record = await db.InformationLifecycles.AsNoTracking().SingleOrDefaultAsync(l => l.ResourceType == kind && l.ResourceId == id && (l.OwnerSiteId == id || l.OwnerSiteId == null), ct);
        var impact = kind == "site" ? await LifecycleImpactQuery.Site(id, db, ct) : await LifecycleImpactQuery.Person(id, db, ct);
        return Results.Ok(new { stage = record?.Stage ?? "active", version = record?.Version ?? 0, held = record?.IsHeld ?? false, impact, irreversibleEnabled = false });
    }
    private sealed record Move(string Stage, long ExpectedVersion, string Reason);
    private static async Task<IResult> Transition(string kind, Guid id, Move request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await csrf.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        if (request.Stage is not ("active" or "closed" or "archived") || !Reason(request.Reason)) return Results.BadRequest();
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var record = await LockRoot(kind, id, db, ct); if (record is null) return Results.NotFound();
        var fresh = db.Entry(record).State == EntityState.Added;
        if ((fresh ? 0 : record.Version) != request.ExpectedVersion) return Results.Conflict(new { code = "lifecycle_version_conflict" });
        if (request.Stage is "closed" or "archived")
        {
            var impact = kind == "site" ? await LifecycleImpactQuery.Site(id, db, ct) : await LifecycleImpactQuery.Person(id, db, ct);
            if (!impact.Eligible) return Results.Conflict(new { code = "lifecycle_unfinished_relationships", impact.Blockers });
        }
        var previous = record.Stage;
        try { record.Transition(request.Stage, record.Version, request.Reason, DateTimeOffset.UtcNow); }
        catch (InvalidOperationException) { return Results.Conflict(new { code = "lifecycle_transition_conflict" }); }
        var type = request.Stage == "archived" ? "information.archived" : request.Stage == "closed" && previous == "active" ? "information.closed" : "information.restored";
        var audit = new AuditEvent(Guid.NewGuid(), kind == "site" ? id : null, actor, type, kind, id, DateTimeOffset.UtcNow);
        if (kind == "site") await DomainEventRecorder.RecordGovernance(db, audit, type, id, kind, id, new { status = record.Stage, previousStatus = previous }, ct);
        else db.AuditEvents.Add(audit); // Global identities have no invented originating tenant.
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct);
        return Results.Ok(new { record.Stage, record.Version });
    }
    private sealed record GrantRequest(Guid PersonId, bool CanExport, string Reason);
    private static async Task<IResult> Grant(Guid siteId, GrantRequest request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await csrf.IsRequestValidAsync(context) || !Reason(request.Reason)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        if (await LockRoot("site", siteId, db, ct) is null) return Results.NotFound();
        if (!await db.People.AnyAsync(p => p.Id == request.PersonId && p.IsActive && !p.IsDeleted, ct) || !await db.LoginIdentities.AnyAsync(i => i.PersonId == request.PersonId && i.IsActive, ct)) return Results.BadRequest();
        if (await db.ArchiveGrants.AnyAsync(g => g.SiteId == siteId && g.PersonId == request.PersonId && g.IsActive, ct)) return Results.Conflict();
        var grant = new ArchiveGrant(Guid.NewGuid(), siteId, request.PersonId, request.CanExport, DateTimeOffset.UtcNow); db.ArchiveGrants.Add(grant);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, "archive-access.granted", "archive-grant", grant.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(grant);
    }
    private sealed record RevokeRequest(long ExpectedVersion, string Reason);
    private static async Task<IResult> Revoke(Guid siteId, Guid grantId, RevokeRequest request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await csrf.IsRequestValidAsync(context) || !Reason(request.Reason)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var root = await LockRoot("site", siteId, db, ct); if (root is null) return Results.NotFound();
        var grant = await db.ArchiveGrants.SingleOrDefaultAsync(g => g.Id == grantId && g.SiteId == siteId, ct); if (grant is null) return Results.NotFound();
        if (root.Stage != "active" && grant.CanExport && !await db.ArchiveGrants.AnyAsync(g => g.SiteId == siteId && g.Id != grantId && g.IsActive && g.CanExport && db.People.Any(p => p.Id == g.PersonId && p.IsActive && !p.IsDeleted) && db.LoginIdentities.Any(i => i.PersonId == g.PersonId && i.IsActive), ct)) return Results.Conflict(new { code = "archive_last_custodian" });
        try { grant.Revoke(request.ExpectedVersion, DateTimeOffset.UtcNow); } catch (InvalidOperationException) { return Results.Conflict(new { code = "lifecycle_version_conflict" }); }
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, "archive-access.revoked", "archive-grant", grant.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.NoContent();
    }
    internal static bool Reason(string? value) => !string.IsNullOrWhiteSpace(value) && value.Length <= 1000 && !value.Any(char.IsControl);
}
