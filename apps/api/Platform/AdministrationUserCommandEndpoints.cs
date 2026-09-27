using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.Platform.AdministrationApiSupport;

namespace Fylkren.Api.Platform;

using static Fylkren.Api.Platform.AdministrationUserSupport;

internal static class AdministrationUserCommandEndpoints
{
    internal static async Task<IResult> AssignUser(Guid personId, AssignUserRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
        var hash = RequestHash("assign", personId, request);
        var replay = await CheckIdempotency(machineId, context, hash, db, ct);
        if (replay is not null) return replay;
        if (!await db.Sites.AnyAsync(site => site.Id == request.SiteId && site.IsActive, ct)) return Validation("siteId", "Målsiten finnes ikke eller er deaktivert.");
        var person = await db.People.SingleOrDefaultAsync(value => value.Id == personId && !value.IsDeleted, ct);
        if (person is null) return Results.NotFound();
        if (await IsPlatformManager(db, personId, ct)) return Problem(context, 409, "platform_account", "Platform Manager-kontoer kan ikke tildeles en site.");
        if (await db.SiteMemberships.AnyAsync(membership =>
                membership.PersonId == personId && membership.IsActive &&
                membership.Site.IsActive, ct))
            return Problem(context, 409, "active_site_membership", "Brukeren har allerede en aktiv site.");
        var now = DateTimeOffset.UtcNow;
        var membership = await db.SiteMemberships.SingleOrDefaultAsync(value => value.PersonId == personId && value.SiteId == request.SiteId, ct);
        if (membership is null) db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), request.SiteId, personId, now));
        else membership.Activate();
        person.Update(person.DisplayName, true);
        foreach (var identity in await db.LoginIdentities
                     .Where(value => value.PersonId == personId && !value.IsActive)
                     .ToListAsync(ct))
            identity.Update(identity.Username, true);
        AddAudit(db, machineId, request.SiteId, "user.assigned", personId, context, now);
        AddIdempotency(db, machineId, context, hash, personId, now);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { id = personId, siteId = request.SiteId });
    }

    internal static async Task<IResult> MoveUser(Guid personId, MoveUserRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
        var hash = RequestHash("move", personId, request);
        var replay = await CheckIdempotency(machineId, context, hash, db, ct);
        if (replay is not null) return replay;
        if (request.SourceSiteId == request.TargetSiteId) return Validation("targetSiteId", "Velg en annen målsite.");
        if (await IsPlatformManager(db, personId, ct)) return Problem(context, 409, "platform_account", "Platform Manager-kontoer kan ikke flyttes mellom sites.");
        var person = await db.People.SingleOrDefaultAsync(value => value.Id == personId && !value.IsDeleted, ct);
        if (person is null) return Results.NotFound();
        var source = await db.SiteMemberships.SingleOrDefaultAsync(value => value.PersonId == personId && value.SiteId == request.SourceSiteId && value.IsActive, ct);
        if (source is null) return Problem(context, 409, "source_membership_missing", "Brukeren har ikke et aktivt medlemskap i kildesiten.");
        if (!await db.Sites.AnyAsync(site => site.Id == request.TargetSiteId && site.IsActive, ct)) return Validation("targetSiteId", "Målsiten finnes ikke eller er deaktivert.");
        if (await db.SiteMemberships.AnyAsync(value => value.PersonId == personId && value.SiteId == request.TargetSiteId && value.IsActive, ct)) return Problem(context, 409, "target_membership_exists", "Brukeren tilhører allerede målsiten.");
        var now = DateTimeOffset.UtcNow;
        source.Deactivate();
        var target = await db.SiteMemberships.SingleOrDefaultAsync(value => value.PersonId == personId && value.SiteId == request.TargetSiteId, ct);
        if (target is null) db.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), request.TargetSiteId, personId, now));
        else target.Activate();
        await RemoveOperationalAccess(db, personId, request.SourceSiteId, request.TargetSiteId, now, ct);
        AddAudit(db, machineId, request.TargetSiteId, "user.moved", personId, context, now);
        AddIdempotency(db, machineId, context, hash, personId, now);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { id = personId, sourceSiteId = request.SourceSiteId, targetSiteId = request.TargetSiteId });
    }

    internal static async Task<IResult> DeactivateUser(Guid personId, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
        var hash = RequestHash("deactivate", personId, "none");
        var replay = await CheckIdempotency(machineId, context, hash, db, ct);
        if (replay is not null) return replay;
        if (await IsPlatformManager(db, personId, ct)) return Problem(context, 409, "platform_account", "Platform Manager-kontoer kan ikke deaktiveres gjennom bruker-API-et.");
        if (await db.SiteMemberships.AnyAsync(value =>
                value.PersonId == personId && value.IsActive && value.Site.IsActive, ct) ||
            await db.SiteManagerAssignments.AnyAsync(value =>
                value.PersonId == personId && value.IsActive && value.Site.IsActive, ct))
            return Problem(context, 409, "active_site_membership", "Brukeren må fjernes eller flyttes fra aktive sites før deaktivering.");
        var person = await db.People.SingleOrDefaultAsync(value => value.Id == personId && !value.IsDeleted, ct);
        if (person is null) return Results.NotFound();
        var now = DateTimeOffset.UtcNow;
        foreach (var role in await db.RoleAssignments.Where(value => value.PersonId == personId && value.IsActive).ToListAsync(ct)) role.Deactivate();
        db.OrganizationUnitMemberships.RemoveRange(await db.OrganizationUnitMemberships.Where(value => value.PersonId == personId).ToListAsync(ct));
        foreach (var run in await db.WorkflowRuns.Where(value => value.ClaimedByPersonId == personId).ToListAsync(ct)) run.Release();
        foreach (var run in await db.ExecutionRuns.Where(value => value.ClaimedByPersonId == personId && value.Status != "submitted" && value.Status != "cancelled").ToListAsync(ct)) run.Release(now);
        await IdentityDeletionService.RemoveAuthenticationAsync(
            [personId], db, now, ct);
        person.Delete(now);
        AddAudit(db, machineId, null, "user.deactivated", personId, context, now);
        AddIdempotency(db, machineId, context, hash, personId, now);
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { id = personId, deactivated = true });
    }

    private static async Task RemoveOperationalAccess(FylkrenDbContext db, Guid personId, Guid sourceSiteId, Guid targetSiteId, DateTimeOffset now, CancellationToken ct)
    {
        db.OrganizationUnitMemberships.RemoveRange(await db.OrganizationUnitMemberships.Where(value => value.PersonId == personId && (value.SiteId == sourceSiteId || value.SiteId == targetSiteId)).ToListAsync(ct));
        foreach (var role in await db.RoleAssignments.Where(value => value.PersonId == personId && value.IsActive && (value.Role.OrganizationUnit.SiteId == sourceSiteId || value.Role.OrganizationUnit.SiteId == targetSiteId)).ToListAsync(ct)) role.Deactivate();
        foreach (var manager in await db.SiteManagerAssignments.Where(value => value.PersonId == personId && value.SiteId == sourceSiteId && value.IsActive).ToListAsync(ct)) manager.Deactivate();
        foreach (var run in await db.WorkflowRuns.Where(value => value.WorkItem.SiteId == sourceSiteId && value.ClaimedByPersonId == personId && value.Status == "in_progress").ToListAsync(ct)) run.Release();
        foreach (var run in await db.ExecutionRuns.Where(value => value.WorkItem.SiteId == sourceSiteId && value.ClaimedByPersonId == personId && value.Status != "submitted" && value.Status != "cancelled").ToListAsync(ct)) run.Release(now);
    }

    private static Task<bool> IsPlatformManager(FylkrenDbContext db, Guid personId, CancellationToken ct) =>
        db.LoginIdentities.AnyAsync(identity => identity.PersonId == personId && identity.IsPlatformManager, ct);


    internal sealed record AssignUserRequest(Guid SiteId);
    internal sealed record MoveUserRequest(Guid SourceSiteId, Guid TargetSiteId);
}
