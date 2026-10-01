using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class SiteManagerEndpoints
{
    internal static RouteGroupBuilder MapSiteManagerEndpoints(this RouteGroupBuilder group)
    {
        group.MapPost("/{siteId:guid}/site-managers", AssignSiteManager)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapDelete("/{siteId:guid}/site-managers/{personId:guid}", RemoveSiteManager)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        return group;
    }

    private static async Task<IResult> AssignSiteManager(Guid siteId, AssignSiteManagerRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context))
            return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId))
            return Results.Problem(statusCode: StatusCodes.Status403Forbidden);
        if (!await database.Sites.AnyAsync(site => site.Id == siteId && site.IsActive, cancellationToken))
            return Results.NotFound();

        var person = await database.People.SingleOrDefaultAsync(value => value.Id == request.PersonId && value.IsActive, cancellationToken);
        if (person is null)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["personId"] = ["The person does not exist or is disabled."] });

        var now = DateTimeOffset.UtcNow;
        var assignment = await database.SiteManagerAssignments.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == request.PersonId, cancellationToken);
        if (assignment?.IsActive == true)
            return Results.Conflict(new { error = "The person is already assigned as a Site Manager." });
        if (assignment is null)
        {
            assignment = new SiteManagerAssignment(Guid.NewGuid(), siteId, request.PersonId, now);
            database.SiteManagerAssignments.Add(assignment);
        }
        else
        {
            assignment.Activate();
        }

        var membership = await database.SiteMemberships.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == request.PersonId, cancellationToken);
        if (membership is null)
            database.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), siteId, request.PersonId, now));
        else
            membership.Activate();
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "site-manager.assigned", "site-manager-assignment", assignment.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created($"/api/sites/{siteId}/site-managers/{assignment.Id}", new PersonSummary(person.Id, person.DisplayName));
    }

    private static async Task<IResult> RemoveSiteManager(Guid siteId, Guid personId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actorPersonId)) return Results.Problem(statusCode: 403);
        var assignment = await database.SiteManagerAssignments.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == personId && value.IsActive, cancellationToken);
        if (assignment is null) return Results.NotFound();
        assignment.Deactivate();
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actorPersonId, "site-manager.deactivated", "site-manager-assignment", assignment.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }
}
