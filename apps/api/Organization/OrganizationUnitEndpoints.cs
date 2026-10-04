using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class OrganizationUnitEndpoints
{
    internal static RouteGroupBuilder MapOrganizationUnitEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/{siteId:guid}/organization-units", CreateUnit);
        group.MapPut("/{siteId:guid}/organization-units/{unitId:guid}", UpdateUnit);
        group.MapPost("/{siteId:guid}/organization-units/{unitId:guid}/reorder", ReorderUnit);
        return group;
    }

    private static async Task<IResult> CreateUnit(Guid siteId, CreateOrganizationUnitRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context))
            return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
        if (!await OrganizationAuthorization.CanAdministerSite(siteId, actorPersonId, database, cancellationToken))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden, title: "Site Manager access is required.");

        var name = (request.Name ?? "").Trim();
        if (name.Length is < 2 or > 200)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The name must be between 2 and 200 characters."] });
        if (request.ParentId is { } parentId && !await database.OrganizationUnits.AnyAsync(unit => unit.Id == parentId && unit.SiteId == siteId && unit.IsActive && !unit.IsSiteRoot, cancellationToken))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["The parent unit does not exist in this site or is disabled."] });

        var effectiveParentId = request.ParentId ?? await database.OrganizationUnits.Where(unit => unit.SiteId == siteId && unit.IsSiteRoot).Select(unit => unit.Id).SingleAsync(cancellationToken);
        if (request.IsSiteLeadership && request.ParentId is not null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["isSiteLeadership"] = ["The executive unit must be directly below the site's top level."] });
        if (request.IsSiteLeadership && await database.OrganizationUnits.AnyAsync(unit => unit.SiteId == siteId && unit.IsSiteLeadership, cancellationToken))
            return Results.Conflict(new { error = "The site already has an executive unit. It cannot be replaced by creating a new unit." });
        if (await database.OrganizationUnits.AnyAsync(unit => unit.SiteId == siteId && unit.ParentId == effectiveParentId && unit.NormalizedName == name.ToUpperInvariant(), cancellationToken))
            return Results.Conflict(new { error = "A unit with this name already exists at the same level." });

        var nextSortOrder = (await database.OrganizationUnits.Where(value => value.SiteId == siteId && value.ParentId == effectiveParentId).Select(value => (int?)value.SortOrder).MaxAsync(cancellationToken)) is { } lastOrder ? NumericBounds.NextVersion(lastOrder) : 0;
        var now = DateTimeOffset.UtcNow;
        var unit = new OrganizationUnit(Guid.NewGuid(), siteId, effectiveParentId, name, request.IsTemporary, now, sortOrder: nextSortOrder, worksAtParentLevel: request.WorksAtParentLevel, isSiteLeadership: request.IsSiteLeadership);
        database.OrganizationUnits.Add(unit);
        database.OrganizationRoles.Add(new OrganizationRole(Guid.NewGuid(), unit.Id, "Manager", true, now));
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "organization-unit.created", "organization-unit", unit.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/sites/{siteId}/organization-units/{unit.Id}", new OrganizationUnitSummary(unit.Id, request.ParentId, unit.Name, unit.IsTemporary, unit.WorksAtParentLevel, unit.IsSiteLeadership, unit.IsActive, unit.SortOrder));
    }

    private static async Task<IResult> UpdateUnit(Guid siteId, Guid unitId, UpdateOrganizationUnitRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId)) return Results.Problem(statusCode: 403);
        if (!await OrganizationAuthorization.CanAdministerSite(siteId, actorPersonId, database, cancellationToken)) return Results.Problem(statusCode: 403, title: "Permission to administer the site is required.");
        var unit = await database.OrganizationUnits.SingleOrDefaultAsync(value => value.Id == unitId && value.SiteId == siteId, cancellationToken);
        if (unit is null) return Results.NotFound();
        if (unit.IsSiteRoot) return Results.Problem(statusCode: 403, title: "The site root can only be changed through site administration.");
        var name = (request.Name ?? "").Trim();
        if (name.Length is < 2 or > 200) return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The name must be between 2 and 200 characters."] });
        if (request.ParentId == unitId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["A unit cannot be its own parent."] });
        var allUnits = await database.OrganizationUnits.Where(value => value.SiteId == siteId).Select(value => new { value.Id, value.ParentId, value.IsSiteRoot }).ToListAsync(cancellationToken);
        var parents = allUnits.ToDictionary(value => value.Id, value => value.ParentId);
        var rootId = allUnits.Single(value => value.IsSiteRoot).Id;
        var effectiveParentId = request.ParentId ?? rootId;
        if (request.IsSiteLeadership && effectiveParentId != rootId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["isSiteLeadership"] = ["The executive unit must be directly below the site's top level."] });
        var currentLeadershipUnitId = await database.OrganizationUnits.Where(value => value.SiteId == siteId && value.IsSiteLeadership).Select(value => (Guid?)value.Id).SingleOrDefaultAsync(cancellationToken);
        if (request.IsSiteLeadership && currentLeadershipUnitId is { } leadershipUnitId && leadershipUnitId != unitId)
            return Results.Conflict(new { error = "The site already has an executive unit. Another unit cannot assume that function here." });
        if (unit.IsSiteLeadership && (!request.IsSiteLeadership || !request.IsActive))
            return Results.Conflict(new { error = "The site's executive unit cannot be removed or disabled. A site must always have exactly one executive unit." });
        var cursor = (Guid?)effectiveParentId;
        while (cursor is { } current)
        {
            if (current == unitId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["The move would create a cycle in the hierarchy."] });
            cursor = parents.GetValueOrDefault(current);
        }
        if (request.ParentId is { } parent && !parents.ContainsKey(parent)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["parentId"] = ["The parent unit does not exist in this site."] });
        if (await database.OrganizationUnits.AnyAsync(value => value.Id != unitId && value.SiteId == siteId && value.ParentId == effectiveParentId && value.NormalizedName == name.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "A unit with this name already exists at the same level." });
        if (!request.IsActive && await database.Sites.AnyAsync(value => value.ParentOrganizationUnitId == unitId && value.IsActive, cancellationToken)) return Results.Conflict(new { error = "The unit is the attachment point for an active site and cannot be disabled until the site is moved." });
        var movedToAnotherParent = unit.ParentId != effectiveParentId;
        var nextSortOrder = movedToAnotherParent
            ? (await database.OrganizationUnits.Where(value => value.SiteId == siteId && value.ParentId == effectiveParentId && value.Id != unitId).Select(value => (int?)value.SortOrder).MaxAsync(cancellationToken)) is { } lastOrder ? NumericBounds.NextVersion(lastOrder) : 0
            : unit.SortOrder;
        unit.Update(effectiveParentId, name, request.IsTemporary, request.IsActive, request.WorksAtParentLevel, nextSortOrder, request.IsSiteLeadership);
        if (!request.WorksAtParentLevel)
        {
            var parentLeadershipAssignments = await database.RoleAssignments.Where(value => value.Role.OrganizationUnitId == unitId && value.CanLeadParentLevel).ToListAsync(cancellationToken);
            foreach (var assignment in parentLeadershipAssignments) assignment.SetParentLevelLeadership(false);
        }
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "organization-unit.updated", "organization-unit", unitId, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new OrganizationUnitSummary(unit.Id, request.ParentId, unit.Name, unit.IsTemporary, unit.WorksAtParentLevel, unit.IsSiteLeadership, unit.IsActive, unit.SortOrder));
    }

    private static async Task<IResult> ReorderUnit(Guid siteId, Guid unitId, ReorderOrganizationUnitRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId)) return Results.Problem(statusCode: 403);
        if (!await OrganizationAuthorization.CanAdministerSite(siteId, actorPersonId, database, cancellationToken)) return Results.Problem(statusCode: 403, title: "Permission to administer the site is required.");
        if (request.Direction is not ("up" or "down")) return Results.ValidationProblem(new Dictionary<string, string[]> { ["direction"] = ["Direction must be up or down."] });
        var unit = await database.OrganizationUnits.SingleOrDefaultAsync(value => value.Id == unitId && value.SiteId == siteId && !value.IsSiteRoot, cancellationToken);
        if (unit is null) return Results.NotFound();
        var siblings = await database.OrganizationUnits.Where(value => value.SiteId == siteId && value.ParentId == unit.ParentId && !value.IsSiteRoot).OrderBy(value => value.SortOrder).ThenBy(value => value.Name).ToListAsync(cancellationToken);
        var index = siblings.FindIndex(value => value.Id == unitId);
        var targetIndex = request.Direction == "up" ? index - 1 : index + 1;
        if (index < 0 || targetIndex < 0 || targetIndex >= siblings.Count) return Results.NoContent();
        var target = siblings[targetIndex];
        var currentOrder = unit.SortOrder;
        unit.Reorder(target.SortOrder);
        target.Reorder(currentOrder);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "organization-unit.reordered", "organization-unit", unitId, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
