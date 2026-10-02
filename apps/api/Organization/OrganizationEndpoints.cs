using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Fylkren.Api.Federation;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

public static class OrganizationEndpoints
{
    public static IEndpointRouteBuilder MapOrganizationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/sites");
        group.MapOrganizationQueries();
        group.MapSiteManagerEndpoints();
        group.MapOrganizationUnitEndpoints();

        group.MapPost("/", async (
            CreateSiteRequest request,
            ClaimsPrincipal user,
            IAntiforgery antiforgery,
            HttpContext context,
            FylkrenDbContext database,
            LicenseService license,
            CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context))
                return Results.BadRequest(new { error = "Antiforgery token validation failed." });

            var name = (request.Name ?? "").Trim();
            if (name.Length is < 2 or > 200)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The name must be between 2 and 200 characters."] });

            var normalizedName = name.ToUpperInvariant();
            if (await database.Sites.AnyAsync(site => site.NormalizedName == normalizedName, cancellationToken))
                return Results.Conflict(new { error = "A site with this name already exists." });

            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId))
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden);

            await using var capacity = await SiteCapacityPolicy.BeginAdditionAsync(database, license, cancellationToken);
            if (capacity is null) return Results.Conflict(new { error = SiteCapacityPolicy.LimitMessage, code = "community_site_limit" });

            var now = DateTimeOffset.UtcNow;
            var site = new Site(Guid.NewGuid(), name, now);
            if (!ValidOverviewDesign(request.OverviewDesign)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["overviewDesign"] = ["Select a valid overview profile."] });
            site.UpdateOverviewDesign(request.OverviewDesign);
            var siteRoot = new OrganizationUnit(Guid.NewGuid(), site.Id, null, site.Name, false, now, true);
            database.Sites.Add(site);
            database.OrganizationUnits.Add(siteRoot);
            DefaultSiteWorkConfiguration.Add(database, site, now);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), site.Id, actorPersonId, "site.created", "site", site.Id, now));
            await database.SaveChangesAsync(cancellationToken);
            await capacity.CommitAsync(cancellationToken);
            return Results.Created($"/api/sites/{site.Id}", new SiteSummary(site.Id, site.ParentOrganizationUnitId, site.Name, site.IsActive, site.OverviewDesign, []));
        })
        .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapPut("/{siteId:guid}", async (Guid siteId, UpdateSiteRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, LicenseService license, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId)) return Results.Problem(statusCode: 403);
            var site = await database.Sites.SingleOrDefaultAsync(value => value.Id == siteId, cancellationToken);
            if (site is null) return Results.NotFound();
            var name = (request.Name ?? "").Trim();
            if (name.Length is < 2 or > 200) return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The name must be between 2 and 200 characters."] });
            if (!ValidOverviewDesign(request.OverviewDesign)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["overviewDesign"] = ["Select a valid overview profile."] });
            if (await database.Sites.AnyAsync(value => value.Id != siteId && value.NormalizedName == name.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "A site with this name already exists." });
            Guid? parentSiteId = null;
            if (request.ParentOrganizationUnitId is { } placementId)
            {
                var placement = await database.OrganizationUnits.Where(unit => unit.Id == placementId && unit.IsActive).Select(unit => new { unit.Id, unit.SiteId }).SingleOrDefaultAsync(cancellationToken);
                if (placement is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentOrganizationUnitId"] = ["The organizational attachment point does not exist or is disabled."] });
                if (placement.SiteId == siteId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentOrganizationUnitId"] = ["A site cannot be placed within its own internal organization."] });
                parentSiteId = placement.SiteId;
            }
            var parentMap = await database.Sites.Select(value => new { value.Id, ParentSiteId = value.ParentOrganizationUnit == null ? (Guid?)null : value.ParentOrganizationUnit.SiteId }).ToDictionaryAsync(value => value.Id, value => value.ParentSiteId, cancellationToken);
            var cursor = parentSiteId;
            while (cursor is { } current) { if (current == siteId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentOrganizationUnitId"] = ["The move would create a cycle in the site hierarchy."] }); cursor = parentMap.GetValueOrDefault(current); }
            await using var capacity = !site.IsActive && request.IsActive
                ? await SiteCapacityPolicy.BeginAdditionAsync(database, license, cancellationToken)
                : null;
            if (!site.IsActive && request.IsActive && capacity is null)
                return Results.Conflict(new { error = SiteCapacityPolicy.LimitMessage, code = "community_site_limit" });
            var nameChanged = site.Name != name;
            site.Update(name, request.ParentOrganizationUnitId, request.IsActive);
            if (request.ParentOrganizationUnitId is not null || !request.IsActive)
                await FederationSitePublicationPolicy.SuspendAsync(siteId, database, DateTimeOffset.UtcNow, cancellationToken);
            else if (nameChanged)
                await FederationSitePublicationPolicy.RefreshAsync(siteId, database, DateTimeOffset.UtcNow, cancellationToken);
            site.UpdateOverviewDesign(request.OverviewDesign);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "site.updated", "site", siteId, DateTimeOffset.UtcNow));
            await database.SaveChangesAsync(cancellationToken);
            if (capacity is not null) await capacity.CommitAsync(cancellationToken);
            return Results.Ok(new SiteSummary(site.Id, site.ParentOrganizationUnitId, site.Name, site.IsActive, site.OverviewDesign, []));
        }).RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapDelete("/{siteId:guid}", async (Guid siteId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId)) return Results.Problem(statusCode: 403);
            var site = await database.Sites.SingleOrDefaultAsync(value => value.Id == siteId, cancellationToken); if (site is null) return Results.NotFound();
            if (!site.IsActive) return Results.Conflict(new { error = "The site has already been deleted." });
            if (await SiteDeactivationService.HasActiveChildrenAsync(siteId, database, cancellationToken))
                return Results.Conflict(new { error = "The site has active subordinate sites. Move or disable them first." });
            var now = DateTimeOffset.UtcNow;
            await SiteDeactivationService.DeactivateAsync(site, database, now, cancellationToken);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "site.deactivated", "site", siteId, now));
            await database.SaveChangesAsync(cancellationToken); return Results.NoContent();
        }).RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.RequireAuthorization();
        endpoints.MapOrganizationPlatformQueries();

        return endpoints;
    }

    private static bool ValidOverviewDesign(string value) => value is "classic" or "minimal";
}
