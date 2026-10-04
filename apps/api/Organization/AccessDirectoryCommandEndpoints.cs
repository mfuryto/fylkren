using System.Net.Mail;
using System.Security.Claims;
using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Identity;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.Licensing;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class AccessDirectoryCommandEndpoints
{
    internal static void Map(RouteGroupBuilder group) =>
        group.MapPost("/directory-users", AddUser).RequireFeature(FeatureCatalog.ExternalIdentity);

    private static async Task<IResult> AddUser(
        Guid siteId,
        AddDirectoryUserRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        DirectoryAuthenticationService directory,
        FylkrenOptions options,
        FylkrenDbContext database,
        IPasswordHasher<LoginIdentity> passwordHasher,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context))
            return Results.BadRequest(new { error = "Antiforgery token validation failed." });
        var actor = await AccessAuthorization.Actor(siteId, user, database, cancellationToken);
        if (actor is null) return Results.Problem(statusCode: 403);
        var provider = NormalizeProvider(request.Provider);
        if (provider is null || !Enabled(provider, options) || string.IsNullOrWhiteSpace(request.StableId) ||
            request.StableId.Length > 512 || string.IsNullOrWhiteSpace(request.Username) || request.Username.Length > 256)
            return Results.NotFound();
        DirectoryUser? directoryUser;
        try
        {
            directoryUser = await directory.FindUserAsync(provider, request.Username, cancellationToken);
        }
        catch (InvalidOperationException)
        {
            return Results.NotFound();
        }
        if (directoryUser is null || !string.Equals(directoryUser.StableId, request.StableId, StringComparison.OrdinalIgnoreCase))
            return Results.NotFound(new { error = "The directory user no longer exists or has changed." });
        var existingLink = await database.ExternalIdentityLinks
            .Include(value => value.Person)
            .ThenInclude(person => person.LoginIdentities)
            .SingleOrDefaultAsync(value => value.Provider == provider && value.SubjectId == directoryUser.StableId && value.IsActive, cancellationToken);
        if (existingLink is not null && await database.SiteMemberships.AnyAsync(value => value.SiteId == siteId && value.PersonId == existingLink.PersonId && value.IsActive, cancellationToken))
            return Results.Conflict(new { error = "The directory user has already been added to this site." });
        var unit = await database.OrganizationUnits.SingleOrDefaultAsync(value => value.Id == request.OrganizationUnitId && value.SiteId == siteId && value.IsActive && !value.IsSiteRoot, cancellationToken);
        if (unit is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["organizationUnitId"] = ["Select an active subordinate unit."] });
        var now = DateTimeOffset.UtcNow;
        Person person;
        if (existingLink is not null)
        {
            person = existingLink.Person;
            person.Update(person.DisplayName, true);
            foreach (var login in person.LoginIdentities) login.Update(login.Username, true);
        }
        else
        {
            var displayName = string.IsNullOrWhiteSpace(directoryUser.DisplayName)
                ? directoryUser.Username
                : directoryUser.DisplayName.Trim();
            var email = NormalizeEmail(directoryUser.Email);
            if (email is not null && await database.People.AnyAsync(value => value.NormalizedEmail == email.ToUpperInvariant(), cancellationToken))
                return Results.Conflict(new { error = "The email address already belongs to an internal person. Link the identity to that person instead." });
            if (email is not null && await database.LoginIdentities.AnyAsync(value => value.NormalizedUsername == email.ToUpperInvariant(), cancellationToken))
                return Results.Conflict(new { error = "The email address is already used as a local username." });
            person = new Person(Guid.NewGuid(), displayName, now, email);
            var anchorUsername = directoryUser.Username.Trim();
            if (!await AvailableAnchor(anchorUsername, email, database, cancellationToken))
                anchorUsername = $"{provider}\\{directoryUser.Username}";
            if (!await AvailableAnchor(anchorUsername, email, database, cancellationToken))
                anchorUsername = $"directory-{Guid.NewGuid():N}";
            var identity = new LoginIdentity(Guid.NewGuid(), person.Id, anchorUsername, false, now);
            identity.SetPasswordHash(passwordHasher.HashPassword(identity, Convert.ToBase64String(RandomNumberGenerator.GetBytes(48))));
            database.AddRange(
                person,
                identity,
                new ExternalIdentityLink(Guid.NewGuid(), person.Id, provider, directoryUser.StableId, directoryUser.Username, now));
        }
        database.AddRange(
            new SiteMembership(Guid.NewGuid(), siteId, person.Id, now),
            new OrganizationUnitMembership(Guid.NewGuid(), siteId, unit.Id, person.Id, now));
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor.Value, $"identity.{provider}.person-added", "person", person.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        return Results.Created(
            $"/api/sites/{siteId}/access/members/{person.Id}",
            new MemberSummary(person.Id, person.DisplayName, person.Email, directoryUser.Username, provider, true, unit.Id, unit.Name));
    }

    private static async Task<bool> AvailableAnchor(string username, string? email, FylkrenDbContext database, CancellationToken cancellationToken) =>
        username.Length <= 100 &&
        !string.Equals(username, email, StringComparison.OrdinalIgnoreCase) &&
        !await database.LoginIdentities.AnyAsync(value => value.NormalizedUsername == username.ToUpperInvariant(), cancellationToken);

    private static string? NormalizeProvider(string? provider) =>
        provider?.Trim().ToLowerInvariant() is "ad" or "ldap" ? provider.Trim().ToLowerInvariant() : null;

    private static bool Enabled(string provider, FylkrenOptions options) =>
        provider == "ad" ? options.Authentication.ActiveDirectory.Enabled : provider == "ldap" && options.Authentication.Ldap.Enabled;

    private static string? NormalizeEmail(string? email) =>
        !string.IsNullOrWhiteSpace(email) && email.Length <= 254 && MailAddress.TryCreate(email.Trim(), out var parsed)
            ? parsed.Address
            : null;

    private sealed record AddDirectoryUserRequest(string Provider, string StableId, string Username, Guid OrganizationUnitId);
    private sealed record MemberSummary(Guid Id, string DisplayName, string? Email, string? Username, string? DirectoryProvider, bool IsActive, Guid? OrganizationUnitId, string? OrganizationUnitName);
}
