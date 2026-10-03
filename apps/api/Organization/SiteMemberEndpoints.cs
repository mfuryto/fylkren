using System.Net.Mail;
using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.Organization.AccessEndpoints;

namespace Fylkren.Api.Organization;

internal static class SiteMemberEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPut("/members/{personId:guid}", async (Guid siteId, Guid personId, UpdateLocalUserRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
            var actor = await Actor(siteId, user, database, cancellationToken); if (actor is null) return Results.Problem(statusCode: 403);
            var membership = await database.SiteMemberships.Include(value => value.Person).ThenInclude(person => person.LoginIdentities).SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == personId && value.IsActive, cancellationToken);
            if (membership is null) return Results.NotFound();
            var identity = membership.Person.LoginIdentities.FirstOrDefault(); if (identity is null) return Results.Conflict(new { error = "The person has no editable local sign-in." });
            var displayName = (request.DisplayName ?? "").Trim(); var username = (request.Username ?? "").Trim(); var email = (request.Email ?? "").Trim();
            var directoryProvider = await database.ExternalIdentityLinks.Where(value => value.PersonId == personId && value.IsActive && (value.Provider == "ad" || value.Provider == "ldap")).Select(value => value.Provider).FirstOrDefaultAsync(cancellationToken);
            var directoryManaged = directoryProvider is not null;
            var hasAccessToAnotherSite = await HasAccessToAnotherSite(
                siteId,
                personId,
                database,
                cancellationToken);
            var changesGlobalIdentity = !request.IsActive ||
                !directoryManaged &&
                (!string.Equals(displayName, membership.Person.DisplayName, StringComparison.Ordinal) ||
                 !string.Equals(username, identity.Username, StringComparison.OrdinalIgnoreCase) ||
                 !string.Equals(email, membership.Person.Email, StringComparison.OrdinalIgnoreCase));
            if (hasAccessToAnotherSite && changesGlobalIdentity)
                return Results.Conflict(new
                {
                    error = "The user is active in multiple sites. Global account details must be changed by the user or by a Platform Manager."
                });
            if (!directoryManaged)
            {
                if (displayName.Length is < 2 or > 200 || username.Length is < 3 or > 100 || !MailAddress.TryCreate(email, out _)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["The name, email address, or username is invalid."] });
                if (string.Equals(username, email, StringComparison.OrdinalIgnoreCase)) return Results.Conflict(new { error = "The username and email address must be different." });
                if (await database.LoginIdentities.AnyAsync(value => value.Id != identity.Id && value.NormalizedUsername == username.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The username is already in use." });
                if (await database.People.AnyAsync(value => value.Id != personId && value.NormalizedEmail == username.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The username is already used as an email address." });
                if (await database.People.AnyAsync(value => value.Id != personId && value.NormalizedEmail == email.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The email address is already in use." });
                if (await database.LoginIdentities.AnyAsync(value => value.Id != identity.Id && value.NormalizedUsername == email.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The email address is already used as a username." });
            }
            OrganizationUnit? organizationUnit = null;
            if (request.OrganizationUnitId is Guid unitId)
            {
                organizationUnit = await database.OrganizationUnits.SingleOrDefaultAsync(value => value.Id == unitId && value.SiteId == siteId && value.IsActive && !value.IsSiteRoot, cancellationToken);
                if (organizationUnit is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["organizationUnitId"] = ["Select an active subordinate unit."] });
            }
            if (directoryManaged) membership.Person.Update(membership.Person.DisplayName, request.IsActive);
            else { membership.Person.UpdateWithEmail(displayName, request.IsActive, email); identity.Update(username, request.IsActive); }
            var unitMembership = await database.OrganizationUnitMemberships.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == personId, cancellationToken);
            if (organizationUnit is null && unitMembership is not null) database.OrganizationUnitMemberships.Remove(unitMembership);
            else if (organizationUnit is not null && unitMembership is null) database.OrganizationUnitMemberships.Add(new OrganizationUnitMembership(Guid.NewGuid(), siteId, organizationUnit.Id, personId, DateTimeOffset.UtcNow));
            else if (organizationUnit is not null) unitMembership!.MoveTo(organizationUnit.Id);
            if (!request.IsActive)
            {
                var assignments = await database.RoleAssignments.Where(value => value.PersonId == personId && value.IsActive && value.Role.OrganizationUnit.SiteId == siteId).ToListAsync(cancellationToken);
                foreach (var assignment in assignments) assignment.Deactivate();
            }
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "local-user.updated", "person", personId, DateTimeOffset.UtcNow));
            await database.SaveChangesAsync(cancellationToken); return Results.Ok(new MemberSummary(personId, membership.Person.DisplayName, membership.Person.Email, identity.Username, directoryProvider, membership.Person.IsActive, organizationUnit?.Id, organizationUnit?.Name));
        });

        group.MapPost("/members/{personId:guid}/password-reset", async (Guid siteId, Guid personId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
            var actor = await Actor(siteId, user, database, cancellationToken); if (actor is null) return Results.Problem(statusCode: 403);
            var identity = await database.LoginIdentities.Include(value => value.Person).SingleOrDefaultAsync(value => value.PersonId == personId && value.Person.SiteMemberships.Any(membership => membership.SiteId == siteId && membership.IsActive), cancellationToken);
            if (identity is null) return Results.NotFound();
            if (await HasAccessToAnotherSite(siteId, personId, database, cancellationToken))
                return Results.Conflict(new
                {
                    error = "The user is active in multiple sites. A Platform Manager must initiate the password reset."
                });
            if (await database.ExternalIdentityLinks.AnyAsync(value => value.PersonId == personId && value.IsActive && (value.Provider == "ad" || value.Provider == "ldap"), cancellationToken))
                return Results.Conflict(new { error = "The password is managed by the directory service." });
            var now = DateTimeOffset.UtcNow;
            var reset = await PasswordResetService.CreateAsync(identity, actor.Value, database, now, cancellationToken);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "local-user.password-reset-initiated", "person", personId, now));
            await database.SaveChangesAsync(cancellationToken);
            return Results.Ok(new { resetCode = reset.Code, expiresAt = reset.Grant.ExpiresAt });
        });

        group.MapDelete("/members/{personId:guid}", async (Guid siteId, Guid personId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
            var actor = await Actor(siteId, user, database, cancellationToken); if (actor is null) return Results.Problem(statusCode: 403);
            if (actor.Value == personId) return Results.Conflict(new { error = "You cannot remove your own active membership." });
            var membership = await database.SiteMemberships.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == personId && value.IsActive, cancellationToken); if (membership is null) return Results.NotFound();
            membership.Deactivate();
            var unitMembership = await database.OrganizationUnitMemberships.SingleOrDefaultAsync(value => value.SiteId == siteId && value.PersonId == personId, cancellationToken);
            if (unitMembership is not null) database.OrganizationUnitMemberships.Remove(unitMembership);
            var assignments = await database.RoleAssignments.Where(value => value.PersonId == personId && value.IsActive && value.Role.OrganizationUnit.SiteId == siteId).ToListAsync(cancellationToken);
            foreach (var assignment in assignments) assignment.Deactivate();
            var claimedPlanningRuns = await database.WorkflowRuns.Where(value => value.WorkItem.SiteId == siteId && value.ClaimedByPersonId == personId && value.Status == "in_progress").ToListAsync(cancellationToken);
            foreach (var run in claimedPlanningRuns) run.Release();
            var claimedExecutionRuns = await database.ExecutionRuns.Where(value => value.WorkItem.SiteId == siteId && value.ClaimedByPersonId == personId && value.Status != "submitted" && value.Status != "cancelled").ToListAsync(cancellationToken);
            foreach (var run in claimedExecutionRuns) run.Release(DateTimeOffset.UtcNow);
            var identity = await database.LoginIdentities.SingleOrDefaultAsync(value => value.PersonId == personId && value.IsActive, cancellationToken);
            var hasOtherActiveAccess = await database.SiteMemberships.AnyAsync(value => value.PersonId == personId && value.SiteId != siteId && value.IsActive && value.Site.IsActive, cancellationToken) || await database.SiteManagerAssignments.AnyAsync(value => value.PersonId == personId && value.IsActive && value.Site.IsActive, cancellationToken);
            if (identity is not null && !identity.IsPlatformManager && !hasOtherActiveAccess) identity.Update(identity.Username, false);
            await Fylkren.Api.DomainEvents.DomainEventRecorder.RecordGovernance(database, new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "site-member.deactivated", "person", personId, DateTimeOffset.UtcNow), "membership.deactivated", siteId, "person", personId, new { status = "inactive" }, cancellationToken);
            foreach (var run in claimedPlanningRuns) Fylkren.Api.DomainEvents.WorkActivity.Add(database, new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "workflow.released-on-member-removal", "workflow-run", run.Id, DateTimeOffset.UtcNow), "assignment.released");
            foreach (var run in claimedExecutionRuns) Fylkren.Api.DomainEvents.WorkActivity.Add(database, new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "execution.released-on-member-removal", "execution-run", run.Id, DateTimeOffset.UtcNow), "assignment.released");
            if (identity is not null && !identity.IsActive) database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "login-identity.deactivated-on-last-membership-removal", "login-identity", identity.Id, DateTimeOffset.UtcNow));
            await database.SaveChangesAsync(cancellationToken); return Results.NoContent();
        });
    }

    private static async Task<bool> HasAccessToAnotherSite(
        Guid siteId,
        Guid personId,
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        await database.SiteMemberships.AnyAsync(value =>
            value.PersonId == personId && value.SiteId != siteId &&
            value.IsActive && value.Site.IsActive, cancellationToken) ||
        await database.SiteManagerAssignments.AnyAsync(value =>
            value.PersonId == personId && value.SiteId != siteId &&
            value.IsActive && value.Site.IsActive, cancellationToken) ||
        await database.RoleAssignments.AnyAsync(value =>
            value.PersonId == personId && value.IsActive &&
            value.Role.IsActive && value.Role.OrganizationUnit.IsActive &&
            value.Role.OrganizationUnit.SiteId != siteId &&
            value.Role.OrganizationUnit.Site.IsActive,
            cancellationToken);
}
