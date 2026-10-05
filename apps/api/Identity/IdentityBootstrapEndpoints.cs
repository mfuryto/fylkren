using System.Data;
using System.Net.Mail;
using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public static partial class IdentityEndpoints
{
    private static async Task<IResult> BootstrapPlatformManager(
        BootstrapRequest request,
        HttpContext context,
        FylkrenDbContext database,
        IPasswordHasher<LoginIdentity> passwordHasher,
        PasswordSecurityPolicy passwordPolicy,
        CancellationToken cancellationToken)
    {
        await using var transaction = await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        await database.Database.ExecuteSqlRawAsync("SELECT pg_advisory_xact_lock(407959214679271);", cancellationToken);
        if (await database.LoginIdentities.AnyAsync(value => value.IsPlatformManager, cancellationToken)) return Results.NotFound();

        var username = (request.Username ?? "").Trim();
        var displayName = (request.DisplayName ?? "").Trim();
        var email = (request.Email ?? "").Trim();
        var password = request.Password ?? "";
        if (username.Length is < 3 or > 100 || displayName.Length is < 2 or > 200 || !MailAddress.TryCreate(email, out _))
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["Check the username, name, and email address."] });
        if (passwordPolicy.Validate(password, username, displayName, email) is { } passwordError)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["password"] = [passwordError] });
        var normalizedUsername = username.ToUpperInvariant();
        var normalizedEmail = email.ToUpperInvariant();
        if (normalizedUsername == normalizedEmail) return Results.Conflict(new { error = "The username and email address must be different." });
        if (await database.LoginIdentities.AnyAsync(value => value.NormalizedUsername == normalizedUsername, cancellationToken) || await database.People.AnyAsync(value => value.NormalizedEmail == normalizedEmail, cancellationToken))
            return Results.Conflict(new { error = "The username or email address is already in use." });

        var now = DateTimeOffset.UtcNow;
        var person = new Person(Guid.NewGuid(), displayName, now, email);
        var identity = new LoginIdentity(Guid.NewGuid(), person.Id, username, true, now);
        identity.SetPasswordHash(passwordHasher.HashPassword(identity, password));
        database.People.Add(person);
        database.LoginIdentities.Add(identity);
        try
        {
            identity.RecordSignIn(now);
            var browserSession = StartBrowserSession(identity, database, context, "bootstrap", now);
            await database.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            await context.SignInAsync(CookieAuthenticationDefaults.AuthenticationScheme, CreatePrincipal(identity, browserSession.Id, now));
        }
        catch (DbUpdateException)
        {
            await transaction.RollbackAsync(cancellationToken);
            return Results.Conflict(new { error = "Initial setup has already been completed or was completed concurrently." });
        }
        return Results.Created("/api/session", new { identity.Username, person.DisplayName });
    }
}
