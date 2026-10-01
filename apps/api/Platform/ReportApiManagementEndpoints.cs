using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal static class ReportApiManagementEndpoints
{
    internal static void MapReportApiManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/report-api")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("/sites", GetSites);
        group.MapGet("/sites/{siteId:guid}", GetSiteConfiguration);
        group.MapPut("/sites/{siteId:guid}/grants", SaveGrant).RequireFeature(FeatureCatalog.MachineApi);
        group.MapDelete("/sites/{siteId:guid}/grants/{grantId:guid}", DeleteGrant);
    }

    private static async Task<IResult> GetSites(
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        Results.Ok(await database.Sites.AsNoTracking()
            .Where(site => site.IsActive)
            .OrderBy(site => site.Name)
            .Select(site => new { siteId = site.Id, site.Name })
            .ToListAsync(cancellationToken));

    private static async Task<IResult> GetSiteConfiguration(
        Guid siteId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await database.Sites.AnyAsync(site => site.Id == siteId && site.IsActive, cancellationToken))
            return Results.NotFound();

        var clients = await database.ApiMachineIdentities.AsNoTracking()
            .Where(identity => identity.IsActive && (" " + identity.Scopes + " ").Contains(" reports:read "))
            .OrderBy(identity => identity.Name)
            .Select(identity => new { identity.Id, identity.Name, identity.KeyId })
            .ToListAsync(cancellationToken);
        var units = await database.OrganizationUnits.AsNoTracking()
            .Where(unit => unit.SiteId == siteId && unit.IsActive && !unit.IsSiteRoot && !unit.IsSiteLeadership)
            .OrderBy(unit => unit.SortOrder)
            .ThenBy(unit => unit.Name)
            .Select(unit => new { unit.Id, unit.Name })
            .ToListAsync(cancellationToken);
        var grants = await database.ApiReportGrants.AsNoTracking()
            .Where(grant => grant.SiteId == siteId)
            .Select(grant => new
            {
                grant.Id,
                grant.MachineIdentityId,
                clientName = grant.MachineIdentity.Name,
                keyId = grant.MachineIdentity.KeyId,
                grant.OrganizationUnitId,
                grant.IncludeClassified
            })
            .ToListAsync(cancellationToken);
        return Results.Ok(new { clients, units, grants });
    }

    private static async Task<IResult> SaveGrant(
        Guid siteId,
        GrantRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Person(user, out var personId)) return Results.Problem(statusCode: 403);
        if (!await database.Sites.AnyAsync(site => site.Id == siteId && site.IsActive, cancellationToken))
            return Results.NotFound();
        if (!await database.ApiMachineIdentities.AnyAsync(identity =>
                identity.Id == request.MachineIdentityId && identity.IsActive &&
                (" " + identity.Scopes + " ").Contains(" reports:read "), cancellationToken))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["machineIdentityId"] = ["The API client does not exist or lacks reports:read."]
            });
        if (request.OrganizationUnitId is Guid unitId &&
            !await database.OrganizationUnits.AnyAsync(unit =>
                unit.Id == unitId && unit.SiteId == siteId && unit.IsActive &&
                !unit.IsSiteRoot && !unit.IsSiteLeadership, cancellationToken))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["organizationUnitId"] = ["The work level does not exist in the site."]
            });

        var grant = await database.ApiReportGrants.SingleOrDefaultAsync(value =>
            value.MachineIdentityId == request.MachineIdentityId && value.SiteId == siteId &&
            value.OrganizationUnitId == request.OrganizationUnitId, cancellationToken);
        if (grant is null)
        {
            grant = new ApiReportGrant(Guid.NewGuid(), request.MachineIdentityId, siteId,
                request.OrganizationUnitId, request.IncludeClassified, DateTimeOffset.UtcNow);
            database.ApiReportGrants.Add(grant);
        }
        else
        {
            grant.Update(request.IncludeClassified);
        }
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
            "report-api.grant-updated", "api-report-grant", grant.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new
        {
            grant.Id,
            grant.MachineIdentityId,
            grant.OrganizationUnitId,
            grant.IncludeClassified
        });
    }

    private static async Task<IResult> DeleteGrant(
        Guid siteId,
        Guid grantId,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Person(user, out var personId)) return Results.Problem(statusCode: 403);
        var grant = await database.ApiReportGrants.SingleOrDefaultAsync(value =>
            value.Id == grantId && value.SiteId == siteId, cancellationToken);
        if (grant is null) return Results.NotFound();

        database.ApiReportGrants.Remove(grant);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
            "report-api.grant-removed", "api-report-grant", grant.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static bool Person(ClaimsPrincipal user, out Guid id) =>
        Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);

    private sealed record GrantRequest(
        Guid MachineIdentityId,
        Guid? OrganizationUnitId,
        bool IncludeClassified);
}
