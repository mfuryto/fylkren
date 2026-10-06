using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal static class WorkApiManagementEndpoints
{
    internal static void Map(IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/work-api")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("/sites", GetSites);
        group.MapGet("/sites/{siteId:guid}", GetSite);
        group.MapPut("/sites/{siteId:guid}/grants", SaveGrant)
            .RequireFeature(FeatureCatalog.MachineApi);
        group.MapDelete("/sites/{siteId:guid}/grants/{grantId:guid}", DeleteGrant);
    }

    private static async Task<IResult> GetSites(FylkrenDbContext db, CancellationToken ct) =>
        Results.Ok(await db.Sites.AsNoTracking().Where(x => x.IsActive)
            .OrderBy(x => x.Name).Select(x => new { siteId = x.Id, x.Name }).ToListAsync(ct));

    private static async Task<IResult> GetSite(Guid siteId, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await db.Sites.AnyAsync(x => x.Id == siteId && x.IsActive, ct)) return Results.NotFound();
        var clients = await db.ApiMachineIdentities.AsNoTracking()
            .Where(x => x.IsActive && ((" " + x.Scopes + " ").Contains(" work:read ") ||
                (" " + x.Scopes + " ").Contains(" work:write ") ||
                (" " + x.Scopes + " ").Contains(" work:transition ") ||
                (" " + x.Scopes + " ").Contains(" activity:read ")))
            .OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.KeyId }).ToListAsync(ct);
        var units = await db.OrganizationUnits.AsNoTracking()
            .Where(x => x.SiteId == siteId && x.IsActive && !x.IsSiteRoot && !x.IsSiteLeadership)
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.Name }).ToListAsync(ct);
        var grants = await db.ApiWorkGrants.AsNoTracking().Where(x => x.SiteId == siteId)
            .OrderBy(x => x.MachineIdentity.Name).Select(x => new
            {
                x.Id, x.MachineIdentityId, clientName = x.MachineIdentity.Name,
                keyId = x.MachineIdentity.KeyId, x.OrganizationUnitId
            }).ToListAsync(ct);
        return Results.Ok(new { clients, units, grants });
    }

    private static async Task<IResult> SaveGrant(Guid siteId, GrantRequest request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        if (!await db.Sites.AnyAsync(x => x.Id == siteId && x.IsActive, ct)) return Results.NotFound();
        if (!await db.ApiMachineIdentities.AnyAsync(x => x.Id == request.MachineIdentityId && x.IsActive &&
                ((" " + x.Scopes + " ").Contains(" work:read ") ||
                 (" " + x.Scopes + " ").Contains(" work:write ") ||
                 (" " + x.Scopes + " ").Contains(" work:transition ") ||
                 (" " + x.Scopes + " ").Contains(" activity:read ")), ct))
            return Validation("machineIdentityId", "The API client does not exist or lacks an operational scope.");
        if (request.OrganizationUnitId is Guid unitId && !await db.OrganizationUnits.AnyAsync(x =>
                x.Id == unitId && x.SiteId == siteId && x.IsActive && !x.IsSiteRoot && !x.IsSiteLeadership, ct))
            return Validation("organizationUnitId", "The work level does not exist in the site.");

        var existing = await db.ApiWorkGrants.SingleOrDefaultAsync(x =>
            x.MachineIdentityId == request.MachineIdentityId && x.SiteId == siteId &&
            x.OrganizationUnitId == request.OrganizationUnitId, ct);
        if (existing is not null) return Results.Ok(new { existing.Id, existing.MachineIdentityId, existing.OrganizationUnitId });
        var grant = new ApiWorkGrant(Guid.NewGuid(), request.MachineIdentityId, siteId,
            request.OrganizationUnitId, DateTimeOffset.UtcNow);
        db.ApiWorkGrants.Add(grant);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor,
            "work-api.grant-created", "api-work-grant", grant.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { grant.Id, grant.MachineIdentityId, grant.OrganizationUnitId });
    }

    private static async Task<IResult> DeleteGrant(Guid siteId, Guid grantId, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        var grant = await db.ApiWorkGrants.SingleOrDefaultAsync(x => x.Id == grantId && x.SiteId == siteId, ct);
        if (grant is null) return Results.NotFound();
        db.ApiWorkGrants.Remove(grant);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor,
            "work-api.grant-removed", "api-work-grant", grant.Id, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private sealed record GrantRequest(Guid MachineIdentityId, Guid? OrganizationUnitId);
}
