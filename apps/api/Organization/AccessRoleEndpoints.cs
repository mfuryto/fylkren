using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class AccessRoleEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/roles", CreateRole);
        group.MapPut("/roles/{roleId:guid}", UpdateRole);
        group.MapDelete("/roles/{roleId:guid}", DeleteRole);
        group.MapPost("/role-assignments", CreateAssignment);
        group.MapPut("/role-assignments/{assignmentId:guid}", UpdateAssignment);
        group.MapDelete("/role-assignments/{assignmentId:guid}", DeleteAssignment);
    }

    private static async Task<IResult> CreateRole(Guid siteId, CreateRoleRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var name = (request.Name ?? "").Trim();
        if (name.Length is < 2 or > 200) return NameValidation();
        if (!await ActiveUnitExists(database, siteId, request.OrganizationUnitId, cancellationToken)) return UnitValidation();
        if (await database.OrganizationRoles.AnyAsync(value => value.OrganizationUnitId == request.OrganizationUnitId && value.NormalizedName == name.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The role already exists in the unit." });
        var now = DateTimeOffset.UtcNow;
        var role = new OrganizationRole(Guid.NewGuid(), request.OrganizationUnitId, name, false, now, request.HasLeaderAccess);
        role.Update(request.OrganizationUnitId, name, request.HasLeaderAccess, request.CanPlan);
        database.OrganizationRoles.Add(role);
        AddAudit(database, siteId, actor.Value, "organization-role.created", "organization-role", role.Id, now);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/sites/{siteId}/access/roles/{role.Id}", new { role.Id, role.Name });
    }

    private static async Task<IResult> UpdateRole(Guid siteId, Guid roleId, UpdateRoleRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var role = await database.OrganizationRoles.Include(value => value.OrganizationUnit).SingleOrDefaultAsync(value => value.Id == roleId && value.OrganizationUnit.SiteId == siteId && value.IsActive, cancellationToken);
        if (role is null) return Results.NotFound();
        var name = (request.Name ?? "").Trim();
        if (name.Length is < 2 or > 200) return NameValidation();
        if (!await ActiveUnitExists(database, siteId, request.OrganizationUnitId, cancellationToken)) return UnitValidation();
        if (role.IsLeader) return Results.Conflict(new { error = "The manager role cannot be edited or moved." });
        if (await database.OrganizationRoles.AnyAsync(value => value.Id != roleId && value.OrganizationUnitId == request.OrganizationUnitId && value.NormalizedName == name.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The role already exists in the unit." });
        role.Update(request.OrganizationUnitId, name, request.HasLeaderAccess, request.CanPlan);
        AddAudit(database, siteId, actor.Value, "organization-role.updated", "organization-role", role.Id, DateTimeOffset.UtcNow);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteRole(Guid siteId, Guid roleId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var role = await database.OrganizationRoles.SingleOrDefaultAsync(value => value.Id == roleId && value.OrganizationUnit.SiteId == siteId && value.IsActive, cancellationToken);
        if (role is null) return Results.NotFound();
        if (role.IsLeader) return Results.Conflict(new { error = "The manager role cannot be deleted." });
        var now = DateTimeOffset.UtcNow;
        if (await database.RoleAssignments.AnyAsync(value => value.RoleId == roleId && value.IsActive && (value.ValidTo == null || value.ValidTo > now), cancellationToken)) return Results.Conflict(new { error = "Remove active role assignments before deleting the role." });
        role.Deactivate();
        AddAudit(database, siteId, actor.Value, "organization-role.deactivated", "organization-role", role.Id, now);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> CreateAssignment(Guid siteId, CreateAssignmentRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        if (request.ValidTo is { } validTo && validTo <= request.ValidFrom) return Results.ValidationProblem(new Dictionary<string, string[]> { ["validTo"] = ["The end date must be after the start date."] });
        var role = await database.OrganizationRoles.SingleOrDefaultAsync(value => value.Id == request.RoleId && value.OrganizationUnit.SiteId == siteId && value.IsActive, cancellationToken);
        var member = await database.SiteMemberships.AnyAsync(value => value.SiteId == siteId && value.PersonId == request.PersonId && value.IsActive, cancellationToken);
        if (role is null || !member) return Results.ValidationProblem(new Dictionary<string, string[]> { ["assignment"] = ["The role or active site membership does not exist."] });
        if (request.CanLeadParentLevel && (!role.IsLeader || !await database.OrganizationUnits.AnyAsync(value => value.Id == role.OrganizationUnitId && value.WorksAtParentLevel, cancellationToken))) return ParentLeadershipValidation();
        if (await database.RoleAssignments.AnyAsync(value => value.RoleId == request.RoleId && value.PersonId == request.PersonId && value.IsActive && (value.ValidTo == null || value.ValidTo > request.ValidFrom) && (request.ValidTo == null || value.ValidFrom < request.ValidTo), cancellationToken)) return Results.Conflict(new { error = "The person already has an overlapping assignment in the role." });
        var now = DateTimeOffset.UtcNow;
        var assignment = new RoleAssignment(Guid.NewGuid(), request.RoleId, request.PersonId, request.ValidFrom, request.ValidTo, now, request.CanLeadParentLevel);
        database.RoleAssignments.Add(assignment);
        AddAudit(database, siteId, actor.Value, "role-assignment.created", "role-assignment", assignment.Id, now);
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/sites/{siteId}/access/role-assignments/{assignment.Id}", new { assignment.Id });
    }

    private static async Task<IResult> UpdateAssignment(Guid siteId, Guid assignmentId, UpdateAssignmentRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var assignment = await database.RoleAssignments.Include(value => value.Role).ThenInclude(role => role.OrganizationUnit).SingleOrDefaultAsync(value => value.Id == assignmentId && value.IsActive && value.Role.OrganizationUnit.SiteId == siteId, cancellationToken);
        if (assignment is null) return Results.NotFound();
        if (request.CanLeadParentLevel && (!assignment.Role.IsLeader || !assignment.Role.OrganizationUnit.WorksAtParentLevel)) return ParentLeadershipValidation();
        assignment.SetParentLevelLeadership(request.CanLeadParentLevel);
        AddAudit(database, siteId, actor.Value, "role-assignment.parent-leadership-updated", "role-assignment", assignment.Id, DateTimeOffset.UtcNow);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> DeleteAssignment(Guid siteId, Guid assignmentId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var assignment = await database.RoleAssignments.SingleOrDefaultAsync(value => value.Id == assignmentId && value.IsActive && value.Role.OrganizationUnit.SiteId == siteId, cancellationToken);
        if (assignment is null) return Results.NotFound();
        assignment.Deactivate();
        AddAudit(database, siteId, actor.Value, "role-assignment.deactivated", "role-assignment", assignment.Id, DateTimeOffset.UtcNow);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static Task<bool> ActiveUnitExists(FylkrenDbContext database, Guid siteId, Guid unitId, CancellationToken cancellationToken) =>
        database.OrganizationUnits.AnyAsync(value => value.Id == unitId && value.SiteId == siteId && value.IsActive, cancellationToken);

    private static void AddAudit(FylkrenDbContext database, Guid siteId, Guid actor, string eventType, string entityType, Guid entityId, DateTimeOffset now) =>
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor, eventType, entityType, entityId, now));

    private static IResult NameValidation() => Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The name must be between 2 and 200 characters."] });
    private static IResult UnitValidation() => Results.ValidationProblem(new Dictionary<string, string[]> { ["organizationUnitId"] = ["The unit does not exist or is disabled."] });
    private static IResult ParentLeadershipValidation() => Results.ValidationProblem(new Dictionary<string, string[]> { ["canLeadParentLevel"] = ["The authority requires the manager role in a unit operating at a superior level."] });

    private sealed record CreateRoleRequest(Guid OrganizationUnitId, string Name, bool HasLeaderAccess, bool CanPlan);
    private sealed record UpdateRoleRequest(Guid OrganizationUnitId, string Name, bool HasLeaderAccess, bool CanPlan);
    private sealed record CreateAssignmentRequest(Guid RoleId, Guid PersonId, DateTimeOffset ValidFrom, DateTimeOffset? ValidTo, bool CanLeadParentLevel);
    private sealed record UpdateAssignmentRequest(bool CanLeadParentLevel);
}
