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
    private static async Task<IResult> MoveUser(
        Guid personId,
        MoveUserRequest request,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context))
            return Results.BadRequest(new { error = "The security check expired. Reload the page and try again." });
        if (!Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
            return Results.Problem(statusCode: 403, title: "The signed-in Platform Manager could not be identified.");
        if (actor == personId)
            return Results.Conflict(new { error = "You cannot move your own site association." });
        if (await database.LoginIdentities.AnyAsync(identity => identity.PersonId == personId && identity.IsPlatformManager, cancellationToken))
            return Results.Conflict(new { error = "Platform Manager accounts belong to the platform and cannot be moved between sites." });
        if (request.SourceSiteId == request.TargetSiteId)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetSiteId"] = ["Select a different target site."] });

        var person = await database.People.SingleOrDefaultAsync(value => value.Id == personId, cancellationToken);
        if (person is null) return Results.NotFound(new { error = "The user no longer exists." });
        var source = await database.SiteMemberships.SingleOrDefaultAsync(
            value => value.PersonId == personId && value.SiteId == request.SourceSiteId && value.IsActive,
            cancellationToken);
        if (source is null) return Results.Conflict(new { error = "The user no longer has an active membership in the source site." });
        if (!await database.Sites.AnyAsync(site => site.Id == request.TargetSiteId && site.IsActive, cancellationToken))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetSiteId"] = ["The target site does not exist or is disabled."] });
        if (await database.SiteMemberships.AnyAsync(
                value => value.PersonId == personId && value.SiteId == request.TargetSiteId && value.IsActive,
                cancellationToken))
            return Results.Conflict(new { error = "The user already belongs to the target site." });

        var now = DateTimeOffset.UtcNow;
        source.Deactivate();
        var target = await database.SiteMemberships.SingleOrDefaultAsync(
            value => value.PersonId == personId && value.SiteId == request.TargetSiteId,
            cancellationToken);
        if (target is null) database.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), request.TargetSiteId, personId, now));
        else target.Activate();

        var unitMemberships = await database.OrganizationUnitMemberships
            .Where(value => value.PersonId == personId && (value.SiteId == request.SourceSiteId || value.SiteId == request.TargetSiteId))
            .ToListAsync(cancellationToken);
        database.OrganizationUnitMemberships.RemoveRange(unitMemberships);

        var assignments = await database.RoleAssignments
            .Where(value => value.PersonId == personId && value.IsActive &&
                (value.Role.OrganizationUnit.SiteId == request.SourceSiteId || value.Role.OrganizationUnit.SiteId == request.TargetSiteId))
            .ToListAsync(cancellationToken);
        foreach (var assignment in assignments) assignment.Deactivate();

        var managerAssignments = await database.SiteManagerAssignments
            .Where(value => value.PersonId == personId && value.SiteId == request.SourceSiteId && value.IsActive)
            .ToListAsync(cancellationToken);
        foreach (var assignment in managerAssignments) assignment.Deactivate();

        var planningRuns = await database.WorkflowRuns
            .Where(value => value.WorkItem.SiteId == request.SourceSiteId && value.ClaimedByPersonId == personId && value.Status == "in_progress")
            .ToListAsync(cancellationToken);
        foreach (var run in planningRuns) Fylkren.Api.DomainEvents.AccessActivity.Release(database, run, now, "user-move");
        var executionRuns = await database.ExecutionRuns
            .Where(value => value.WorkItem.SiteId == request.SourceSiteId && value.ClaimedByPersonId == personId && value.Status != "submitted" && value.Status != "cancelled")
            .ToListAsync(cancellationToken);
        foreach (var run in executionRuns) Fylkren.Api.DomainEvents.AccessActivity.Release(database, run, now, "user-move");

        var login = await database.LoginIdentities.SingleOrDefaultAsync(value => value.PersonId == personId, cancellationToken);
        if (login is not null && !login.IsActive) login.Update(login.Username, true);

        database.AuditEvents.AddRange(
            new AuditEvent(Guid.NewGuid(), request.SourceSiteId, actor, "platform-user.moved-out", "person", personId, now),
            new AuditEvent(Guid.NewGuid(), request.TargetSiteId, actor, "platform-user.moved-in", "person", personId, now),
            new AuditEvent(Guid.NewGuid(), null, actor, "platform-user.moved", "person", personId, now));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> ResetUserPasswords(
        BulkResetPasswordRequest request,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var validation = await ValidateBulkRequest(request.PersonIds, antiforgery, context, database, cancellationToken);
        if (validation.Error is not null) return validation.Error;
        if (await database.LoginIdentities.AnyAsync(identity => request.PersonIds.Contains(identity.PersonId) && identity.IsPlatformManager, cancellationToken))
            return Results.Conflict(new { error = "Platform Manager passwords cannot be reset from the global user overview." });
        if (await database.ExternalIdentityLinks.AnyAsync(value => request.PersonIds.Contains(value.PersonId) && value.IsActive && (value.Provider == "ad" || value.Provider == "ldap"), cancellationToken))
            return Results.Conflict(new { error = "One or more selected users have passwords managed by the directory service." });

        var identities = await database.LoginIdentities.Include(value => value.Person)
            .Where(value => request.PersonIds.Contains(value.PersonId) && value.IsActive && value.Person.IsActive && !value.Person.IsDeleted)
            .ToListAsync(cancellationToken);
        if (identities.Count != request.PersonIds.Distinct().Count())
            return Results.Conflict(new { error = "One or more selected users do not have an active local sign-in account." });
        var now = DateTimeOffset.UtcNow;
        var resetCodes = new List<object>();
        foreach (var identity in identities)
        {
            var reset = await PasswordResetService.CreateAsync(identity, validation.Actor, database, now, cancellationToken);
            resetCodes.Add(new { personId = identity.PersonId, displayName = identity.Person.DisplayName, resetCode = reset.Code, expiresAt = reset.Grant.ExpiresAt });
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, validation.Actor, "platform-user.password-reset-initiated", "person", identity.PersonId, now));
        }
        await database.SaveChangesAsync(cancellationToken);
        return Results.Ok(new { resetCodes });
    }
}
