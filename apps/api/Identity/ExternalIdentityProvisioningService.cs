using System.Data;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

public sealed class ExternalIdentityProvisioningService
{
    public async Task<ExternalIdentityResolution?> ResolveAsync(
        FylkrenDbContext database,
        string provider,
        string providerInstanceId,
        string subjectId,
        string? username,
        string? displayName,
        string? email,
        bool automaticProvisioning,
        CancellationToken cancellationToken)
    {
        provider = provider.Trim().ToLowerInvariant();
        providerInstanceId = providerInstanceId.Trim();
        subjectId = subjectId.Trim();
        if (provider is not ("oidc" or "saml") || providerInstanceId.Length is < 1 or > 1000 ||
            subjectId.Length is < 1 or > 256)
            return null;

        username = Bounded(username, 256);
        displayName = Bounded(displayName, 200);
        email = ValidEmail(email);

        await using var transaction = database.Database.CurrentTransaction is null
            ? await database.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken)
            : null;
        var lockKey = AdvisoryLockKey(provider, providerInstanceId, subjectId);
        await database.Database.ExecuteSqlInterpolatedAsync(
            $"SELECT pg_advisory_xact_lock({lockKey})", cancellationToken);

        var link = await database.ExternalIdentityLinks
            .Include(value => value.Person)
            .SingleOrDefaultAsync(value => value.Provider == provider &&
                value.ProviderInstanceId == providerInstanceId && value.SubjectId == subjectId,
                cancellationToken);
        if (link is not null)
        {
            if (!link.IsActive)
                return await RejectAsync(database, transaction, provider, providerInstanceId, subjectId,
                    username, displayName, email, "inactive-link", cancellationToken);
            var existingIdentity = await database.LoginIdentities.Include(value => value.Person)
                .SingleOrDefaultAsync(value => value.PersonId == link.PersonId && value.IsActive && value.Person.IsActive,
                    cancellationToken);
            if (existingIdentity is null)
                return await RejectAsync(database, transaction, provider, providerInstanceId, subjectId,
                    username, displayName, email, "inactive-person", cancellationToken);
            if (link.ProvisionedAt is not null)
            {
                if (await ConflictsAsync(database, link.PersonId, username, email, cancellationToken))
                    return await RejectAsync(database, transaction, provider, providerInstanceId, subjectId,
                        username, displayName, email, "claim-collision", cancellationToken);
                link.UpdateUsername(username);
                link.Person.UpdateDirectoryProfile(displayName ?? username ?? link.Person.DisplayName, email);
                await database.SaveChangesAsync(cancellationToken);
                if (transaction is not null) await transaction.CommitAsync(cancellationToken);
            }
            return new(existingIdentity, link.ProvisionedAt is not null);
        }

        if (!automaticProvisioning)
            return null;
        if (await ConflictsAsync(database, null, username, email, cancellationToken))
            return await RejectAsync(database, transaction, provider, providerInstanceId, subjectId,
                username, displayName, email, "claim-collision", cancellationToken);

        var now = DateTimeOffset.UtcNow;
        var person = new Person(Guid.NewGuid(), displayName ?? username ?? $"{provider.ToUpperInvariant()} user", now, email);
        var localUsername = username is { Length: <= 100 }
            ? username
            : GeneratedUsername(provider, providerInstanceId, subjectId);
        if (await database.LoginIdentities.AnyAsync(value => value.NormalizedUsername == localUsername.ToUpperInvariant(), cancellationToken))
            return await RejectAsync(database, transaction, provider, providerInstanceId, subjectId,
                username, displayName, email, "username-collision", cancellationToken);
        var identity = new LoginIdentity(Guid.NewGuid(), person.Id, localUsername, false, now);
        link = new ExternalIdentityLink(Guid.NewGuid(), person.Id, provider, providerInstanceId, subjectId, username, now);
        link.MarkProvisioned(now);
        person.LoginIdentities.Add(identity);
        person.ExternalIdentityLinks.Add(link);
        database.People.Add(person);
        database.AuditEvents.Add(AuditEvent.FromSystem(Guid.NewGuid(), "Identity provider",
            $"identity.{provider}.person-provisioned", "person", person.Id, now));
        await database.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return new(identity, true);
    }

    private static async Task<ExternalIdentityResolution?> RejectAsync(FylkrenDbContext database,
        Microsoft.EntityFrameworkCore.Storage.IDbContextTransaction? transaction, string provider,
        string providerInstanceId, string subjectId, string? username, string? displayName,
        string? email, string reason, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var issue = await database.ExternalIdentityProvisioningIssues.SingleOrDefaultAsync(value =>
            value.Provider == provider && value.ProviderInstanceId == providerInstanceId &&
            value.SubjectId == subjectId, cancellationToken);
        if (issue is null)
        {
            issue = new ExternalIdentityProvisioningIssue(Guid.NewGuid(), provider, providerInstanceId,
                subjectId, username, displayName, email, reason, now);
            database.ExternalIdentityProvisioningIssues.Add(issue);
            database.AuditEvents.Add(AuditEvent.FromSystem(Guid.NewGuid(), "Identity provider",
                $"identity.{provider}.provisioning-review-required", "external-identity-provisioning-issue",
                issue.Id, now));
        }
        else issue.Update(username, displayName, email, reason, now);
        await database.SaveChangesAsync(cancellationToken);
        if (transaction is not null) await transaction.CommitAsync(cancellationToken);
        return null;
    }

    private static async Task<bool> ConflictsAsync(FylkrenDbContext database, Guid? personId,
        string? username, string? email, CancellationToken cancellationToken)
    {
        if (username is not null)
        {
            var normalized = username.ToUpperInvariant();
            if (await database.LoginIdentities.AsNoTracking().AnyAsync(value =>
                value.NormalizedUsername == normalized && (!personId.HasValue || value.PersonId != personId.Value), cancellationToken))
                return true;
        }
        if (email is not null)
        {
            var normalized = email.ToUpperInvariant();
            if (await database.People.AsNoTracking().AnyAsync(value =>
                value.NormalizedEmail == normalized && (!personId.HasValue || value.Id != personId.Value), cancellationToken))
                return true;
        }
        return false;
    }

    private static long AdvisoryLockKey(string provider, string providerInstanceId, string subjectId)
    {
        var digest = SHA256.HashData(Encoding.UTF8.GetBytes($"{provider}\n{providerInstanceId}\n{subjectId}"));
        return BitConverter.ToInt64(digest, 0);
    }

    private static string GeneratedUsername(string provider, string providerInstanceId, string subjectId)
    {
        var digest = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{providerInstanceId}\n{subjectId}")))
            .ToLowerInvariant();
        return $"{provider}-{digest[..24]}";
    }

    private static string? Bounded(string? value, int maximum)
    {
        value = string.IsNullOrWhiteSpace(value) ? null : value.Trim();
        return value is not null && value.Length <= maximum && !value.Any(char.IsControl) ? value : null;
    }

    private static string? ValidEmail(string? value)
    {
        value = Bounded(value, 320);
        if (value is null) return null;
        try { return new MailAddress(value).Address == value ? value : null; }
        catch (FormatException) { return null; }
    }
}

public sealed record ExternalIdentityResolution(LoginIdentity Identity, bool ProviderManaged);
