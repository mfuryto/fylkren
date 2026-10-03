using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static partial class PlatformUserEndpoints
{
    private static async Task<IResult> AssignUsers(
        BulkAssignRequest request,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var validation = await ValidateBulkRequest(request.PersonIds, antiforgery, context, database, cancellationToken);
        if (validation.Error is not null) return validation.Error;
        if (!await database.Sites.AnyAsync(site => site.Id == request.SiteId && site.IsActive, cancellationToken))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["siteId"] = ["The target site does not exist or is disabled."] });
        if (await database.SiteMemberships.AnyAsync(membership =>
                request.PersonIds.Contains(membership.PersonId) && membership.IsActive &&
                membership.Site.IsActive, cancellationToken))
            return Results.Conflict(new { error = "One or more selected users already have an active site. Refresh the search and try again." });
        if (await database.LoginIdentities.AnyAsync(identity => request.PersonIds.Contains(identity.PersonId) && identity.IsPlatformManager, cancellationToken))
            return Results.Conflict(new { error = "Platform Manager accounts belong to the platform and cannot be assigned to a site." });

        var now = DateTimeOffset.UtcNow;
        var people = await database.People.Where(person => request.PersonIds.Contains(person.Id)).ToDictionaryAsync(person => person.Id, cancellationToken);
        foreach (var personId in request.PersonIds.Distinct())
        {
            people[personId].Update(people[personId].DisplayName, true);
            var membership = await database.SiteMemberships.SingleOrDefaultAsync(value => value.SiteId == request.SiteId && value.PersonId == personId, cancellationToken);
            if (membership is null) database.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), request.SiteId, personId, now));
            else membership.Activate();
            var login = await database.LoginIdentities.SingleOrDefaultAsync(value => value.PersonId == personId, cancellationToken);
            if (login is not null && !login.IsActive) login.Update(login.Username, true);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), request.SiteId, validation.Actor, "platform-user.assigned", "person", personId, now));
        }
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { assigned = request.PersonIds.Distinct().Count() });
    }

    private static async Task<IResult> DeleteUsers(
        BulkDeleteRequest request,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var validation = await ValidateBulkRequest(request.PersonIds, antiforgery, context, database, cancellationToken);
        if (validation.Error is not null) return validation.Error;
        if (request.PersonIds.Contains(validation.Actor))
            return Results.Conflict(new { error = "You cannot delete your own user account." });
        if (await database.LoginIdentities.AnyAsync(identity => request.PersonIds.Contains(identity.PersonId) && identity.IsPlatformManager, cancellationToken))
            return Results.Conflict(new { error = "Platform Manager accounts cannot be deleted through personnel cleanup." });
        if (await database.SiteMemberships.AnyAsync(membership =>
                request.PersonIds.Contains(membership.PersonId) && membership.IsActive &&
                membership.Site.IsActive, cancellationToken) ||
            await database.SiteManagerAssignments.AnyAsync(assignment =>
                request.PersonIds.Contains(assignment.PersonId) && assignment.IsActive &&
                assignment.Site.IsActive, cancellationToken))
            return Results.Conflict(new { error = "One or more selected users still have an active site association." });

        var people = await database.People.Where(person => request.PersonIds.Contains(person.Id) && !person.IsDeleted).ToListAsync(cancellationToken);
        var ids = people.Select(person => person.Id).ToArray();
        var assignments = await database.RoleAssignments.Where(value => ids.Contains(value.PersonId) && value.IsActive).ToListAsync(cancellationToken);
        foreach (var assignment in assignments) assignment.Deactivate();
        var managers = await database.SiteManagerAssignments.Where(value => ids.Contains(value.PersonId) && value.IsActive).ToListAsync(cancellationToken);
        foreach (var manager in managers) manager.Deactivate();
        var memberships = await database.SiteMemberships.Where(value => ids.Contains(value.PersonId) && value.IsActive).ToListAsync(cancellationToken);
        foreach (var membership in memberships) membership.Deactivate();
        database.OrganizationUnitMemberships.RemoveRange(await database.OrganizationUnitMemberships.Where(value => ids.Contains(value.PersonId)).ToListAsync(cancellationToken));

        var now = DateTimeOffset.UtcNow;
        var planningRuns = await database.WorkflowRuns.Where(value => value.ClaimedByPersonId != null && ids.Contains(value.ClaimedByPersonId.Value)).ToListAsync(cancellationToken);
        foreach (var run in planningRuns) Fylkren.Api.DomainEvents.AccessActivity.Release(database, run, now, "user-deactivation");
        var executionRuns = await database.ExecutionRuns.Where(value => value.ClaimedByPersonId != null && ids.Contains(value.ClaimedByPersonId.Value) && value.Status != "submitted" && value.Status != "cancelled").ToListAsync(cancellationToken);
        foreach (var run in executionRuns) Fylkren.Api.DomainEvents.AccessActivity.Release(database, run, now, "user-deactivation");

        await IdentityDeletionService.RemoveAuthenticationAsync(
            ids, database, now, cancellationToken);
        foreach (var person in people)
        {
            person.Delete(now);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, validation.Actor, "platform-user.deleted", "person", person.Id, now));
        }
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { deleted = people.Count });
    }

    private static async Task<(Guid Actor, IResult? Error)> ValidateBulkRequest(
        Guid[] personIds,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context))
            return (Guid.Empty, Results.BadRequest(new { error = "The security check expired. Reload the page and try again." }));
        if (!Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
            return (Guid.Empty, Results.Problem(statusCode: 403, title: "The signed-in Platform Manager could not be identified."));
        var ids = personIds.Distinct().ToArray();
        if (ids.Length is < 1 or > 200)
            return (actor, Results.ValidationProblem(new Dictionary<string, string[]> { ["personIds"] = ["Select between 1 and 200 users."] }));
        if (await database.People.CountAsync(person => ids.Contains(person.Id) && !person.IsDeleted, cancellationToken) != ids.Length)
            return (actor, Results.Conflict(new { error = "One or more selected users no longer exist. Refresh the list." }));
        return (actor, null);
    }
}
