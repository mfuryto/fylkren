using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Portability;

public static partial class PortabilityEndpoints
{
    private static async Task<bool> CanExport(Guid siteId, Guid actor, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) =>
        await CanAdminister(siteId, actor, user, db, ct) || await ArchiveAccess.CanExport(siteId, actor, db, ct);
    private static async Task<IResult> Receipts(Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var actor) || !await CanExport(siteId, actor, user, db, ct)) return Results.Problem(statusCode: 403);
        return Results.Ok(await db.ExportReceipts.AsNoTracking().Where(r => r.SiteId == siteId).OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id).Take(20).ToListAsync(ct));
    }
    private sealed record Handoff(long ExpectedVersion, string PackageSha256, string Reason);
    private static async Task<IResult> Acknowledge(Guid siteId, Guid exportId, Handoff request, ClaimsPrincipal user, HttpContext context, IAntiforgery csrf, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await csrf.IsRequestValidAsync(context) || !GovernanceLifecycleEndpoints.Reason(request.Reason)) return Results.BadRequest();
        if (!PersonId(user, out var actor) || !await CanExport(siteId, actor, user, db, ct)) return Results.Problem(statusCode: 403);
        await using var tx = await db.Database.BeginTransactionAsync(ct);
        var receipt = await db.ExportReceipts.FromSqlInterpolated($"SELECT * FROM export_receipts WHERE id = {exportId} AND site_id = {siteId} FOR UPDATE").SingleOrDefaultAsync(ct);
        if (receipt is null) return Results.NotFound();
        try { receipt.Acknowledge(request.ExpectedVersion, actor, request.PackageSha256, request.Reason, DateTimeOffset.UtcNow); }
        catch (InvalidOperationException) { return Results.Conflict(new { code = "export_receipt_conflict" }); }
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, "portability.handoff-acknowledged", "portable-export", exportId, DateTimeOffset.UtcNow).WithReason(request.Reason));
        await db.SaveChangesAsync(ct); await tx.CommitAsync(ct); return Results.Ok(new { receipt.Version, receipt.AcknowledgedAt, irreversibleEnabled = false });
    }
    private static async Task<IResult> ExitStatus(Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var actor) || !await CanExport(siteId, actor, user, db, ct)) return Results.Problem(statusCode: 403);
        if (!await db.Sites.AnyAsync(s => s.Id == siteId, ct)) return Results.NotFound();
        var root = await db.InformationLifecycles.AsNoTracking().SingleOrDefaultAsync(l => l.OwnerSiteId == siteId && l.ResourceType == "site" && l.ResourceId == siteId, ct);
        var latest = await db.ExportReceipts.AsNoTracking().Where(r => r.SiteId == siteId).OrderByDescending(r => r.CreatedAt).ThenBy(r => r.Id).FirstOrDefaultAsync(ct);
        return Results.Ok(new { scope = "site-package", stage = root?.Stage ?? "active", held = root?.IsHeld ?? false, policyConfigured = root?.PolicyId != null,
            exportId = latest?.Id, handoffAcknowledged = latest?.AcknowledgedAt != null, snapshotRootCurrent = root != null && root.Stage != "active" && latest != null && latest.RootLifecycleVersion == (root?.Version ?? 0),
            relationships = await LifecycleImpactQuery.Site(siteId, db, ct), irreversibleEnabled = false, restorationSupported = false });
    }
}
