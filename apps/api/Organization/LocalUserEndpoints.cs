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

internal static class LocalUserEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/local-users", async (Guid siteId, CreateLocalUserRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenOptions options, FylkrenDbContext database, IPasswordHasher<LoginIdentity> passwordHasher, CancellationToken cancellationToken) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(new { error = "Antiforgery token validation failed." });
            if (!options.Authentication.LocalEnabled) return Results.NotFound();
            var actor = await LocalUserActor(siteId, user, database, cancellationToken); if (actor is null) return Results.Problem(statusCode: 403);
            var siteName = await database.Sites.Where(value => value.Id == siteId && value.IsActive).Select(value => value.Name).SingleOrDefaultAsync(cancellationToken);
            if (siteName is null) return Results.NotFound();
            var displayName = (request.DisplayName ?? "").Trim(); var username = (request.Username ?? "").Trim(); var email = (request.Email ?? "").Trim();
            if (displayName.Length is < 2 or > 200 || username.Length is < 3 or > 100 || !MailAddress.TryCreate(email, out _))
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["The name, email address, or username is invalid."] });
            if (string.Equals(username, email, StringComparison.OrdinalIgnoreCase)) return Results.Conflict(new { error = "The username and email address must be different." });
            if (await database.LoginIdentities.AnyAsync(value => value.NormalizedUsername == username.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The username is already in use." });
            if (await database.People.AnyAsync(value => value.NormalizedEmail == username.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The username is already used as an email address." });
            if (await database.People.AnyAsync(value => value.NormalizedEmail == email.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The email address is already in use." });
            if (await database.LoginIdentities.AnyAsync(value => value.NormalizedUsername == email.ToUpperInvariant(), cancellationToken)) return Results.Conflict(new { error = "The email address is already used as a username." });
            OrganizationUnit? organizationUnit = null;
            if (request.OrganizationUnitId is Guid unitId)
            {
                organizationUnit = await database.OrganizationUnits.SingleOrDefaultAsync(value => value.Id == unitId && value.SiteId == siteId && value.IsActive && !value.IsSiteRoot, cancellationToken);
                if (organizationUnit is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["organizationUnitId"] = ["Select an active subordinate unit."] });
            }
            var now = DateTimeOffset.UtcNow; var person = new Person(Guid.NewGuid(), displayName, now, email); var identity = new LoginIdentity(Guid.NewGuid(), person.Id, username, false, now);
            identity.SetPasswordHash(passwordHasher.HashPassword(identity, Convert.ToBase64String(System.Security.Cryptography.RandomNumberGenerator.GetBytes(48))));
            database.People.Add(person); database.LoginIdentities.Add(identity); database.SiteMemberships.Add(new SiteMembership(Guid.NewGuid(), siteId, person.Id, now));
            if (organizationUnit is not null) database.OrganizationUnitMemberships.Add(new OrganizationUnitMembership(Guid.NewGuid(), siteId, organizationUnit.Id, person.Id, now));
            var reset = await PasswordResetService.CreateAsync(identity, actor.Value, database, now, cancellationToken);
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor.Value, "local-user.created", "person", person.Id, now));
            await database.SaveChangesAsync(cancellationToken);
            return Results.Created($"/api/sites/{siteId}/access/members/{person.Id}", new { member = new MemberSummary(person.Id, person.DisplayName, person.Email, identity.Username, null, true, organizationUnit?.Id, organizationUnit?.Name), resetCode = reset.Code, expiresAt = reset.Grant.ExpiresAt });
        });
    }
}
