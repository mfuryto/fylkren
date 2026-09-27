using System.Net.Mail;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Identity;

internal sealed record DirectoryLifecycleSummary(
    int Checked, int Active, int Suspended, int Resumed, int MissingPending, int Unavailable);

internal sealed class DirectoryLifecycleSynchronizer(
    IServiceScopeFactory scopeFactory,
    DirectoryAuthenticationService directory,
    FylkrenOptions options,
    ILogger<DirectoryLifecycleSynchronizer> logger)
{
    private readonly SemaphoreSlim cycleGate = new(1, 1);

    internal async Task<DirectoryLifecycleSummary> RunOnceAsync(CancellationToken cancellationToken)
    {
        if (!options.Authentication.DirectoryLifecycle.Enabled)
            return new(0, 0, 0, 0, 0, 0);
        if (!await cycleGate.WaitAsync(0, cancellationToken))
            throw new InvalidOperationException("A directory lifecycle synchronization is already running.");
        try
        {
            await using var listScope = scopeFactory.CreateAsyncScope();
            var listDatabase = listScope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
            var linkIds = await listDatabase.ExternalIdentityLinks.AsNoTracking()
                .Where(link => link.IsActive && (link.Provider == "ad" || link.Provider == "ldap"))
                .OrderBy(link => link.Provider).ThenBy(link => link.Id)
                .Select(link => link.Id)
                .ToArrayAsync(cancellationToken);

            var checkedCount = 0;
            var active = 0;
            var suspended = 0;
            var resumed = 0;
            var missingPending = 0;
            var unavailable = 0;
            foreach (var linkId in linkIds)
            {
                cancellationToken.ThrowIfCancellationRequested();
                await using var scope = scopeFactory.CreateAsyncScope();
                var database = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                var link = await database.ExternalIdentityLinks
                    .Include(value => value.Person)
                    .ThenInclude(person => person.LoginIdentities)
                    .SingleOrDefaultAsync(value => value.Id == linkId && value.IsActive, cancellationToken);
                if (link is null) continue;

                DirectoryLifecycleResult result;
                try
                {
                    result = await directory.LookupLifecycleAsync(
                        link.Provider, link.SubjectId, cancellationToken);
                }
                catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
                {
                    throw;
                }
                catch (Exception exception)
                {
                    logger.LogWarning(exception,
                        "Directory lifecycle lookup failed; provider={Provider}; linkId={LinkId}",
                        link.Provider, link.Id);
                    result = new(DirectoryAccountState.Unavailable, null, "lookup-failed");
                }

                checkedCount++;
                var now = DateTimeOffset.UtcNow;
                switch (result.State)
                {
                    case DirectoryAccountState.Active when result.User is not null:
                        var wasResumed = link.RecordDirectoryActive(result.User.Username, now);
                        await SynchronizeProfile(database, link, result.User, cancellationToken);
                        if (wasResumed)
                        {
                            AdvanceSecurityVersions(link.Person);
                            AddSystemAudit(database, link, "identity.directory.account-resumed", now);
                            resumed++;
                            logger.LogWarning(
                                "Security event {SecurityEvent}; provider={Provider}; linkId={LinkId}; personId={PersonId}",
                                "directory-account-resumed", link.Provider, link.Id, link.PersonId);
                        }
                        active++;
                        break;
                    case DirectoryAccountState.Disabled:
                        if (link.RecordDirectoryDisabled(result.Status, now))
                        {
                            AdvanceSecurityVersions(link.Person);
                            AddSystemAudit(database, link, "identity.directory.account-suspended", now);
                            suspended++;
                            logger.LogWarning(
                                "Security event {SecurityEvent}; provider={Provider}; linkId={LinkId}; personId={PersonId}; reason={Reason}",
                                "directory-account-suspended", link.Provider, link.Id, link.PersonId, result.Status);
                        }
                        break;
                    case DirectoryAccountState.Missing:
                        if (link.RecordDirectoryMissing(now,
                                options.Authentication.DirectoryLifecycle.MissingConfirmationCount))
                        {
                            AdvanceSecurityVersions(link.Person);
                            AddSystemAudit(database, link, "identity.directory.account-suspended", now);
                            suspended++;
                            logger.LogWarning(
                                "Security event {SecurityEvent}; provider={Provider}; linkId={LinkId}; personId={PersonId}; reason={Reason}",
                                "directory-account-suspended", link.Provider, link.Id, link.PersonId, "missing");
                        }
                        else if (link.DirectoryAccessEnabled)
                        {
                            missingPending++;
                        }
                        break;
                    default:
                        link.RecordDirectoryUnavailable(now);
                        unavailable++;
                        logger.LogWarning(
                            "Directory lifecycle check was inconclusive; provider={Provider}; linkId={LinkId}; status={Status}",
                            link.Provider, link.Id, result.Status);
                        break;
                }
                await database.SaveChangesAsync(cancellationToken);
            }

            return new(checkedCount, active, suspended, resumed, missingPending, unavailable);
        }
        finally
        {
            cycleGate.Release();
        }
    }

    private static async Task SynchronizeProfile(FylkrenDbContext database, ExternalIdentityLink link,
        DirectoryUser user, CancellationToken cancellationToken)
    {
        if (link.Person.IsDeleted) return;
        var displayName = string.IsNullOrWhiteSpace(user.DisplayName)
            ? user.Username.Trim()
            : user.DisplayName.Trim();
        var email = NormalizeEmail(user.Email);
        if (email is not null && await database.People.AnyAsync(
                person => person.Id != link.PersonId && person.NormalizedEmail == email.ToUpperInvariant(),
                cancellationToken))
        {
            link.Person.Update(displayName, link.Person.IsActive);
            return;
        }
        link.Person.UpdateDirectoryProfile(displayName, email);
    }

    private static string? NormalizeEmail(string? email) =>
        !string.IsNullOrWhiteSpace(email) && email.Length <= 254 &&
        MailAddress.TryCreate(email.Trim(), out var parsed) &&
        string.Equals(parsed.Address, email.Trim(), StringComparison.OrdinalIgnoreCase)
            ? parsed.Address
            : null;

    private static void AdvanceSecurityVersions(Person person)
    {
        foreach (var identity in person.LoginIdentities.Where(identity => identity.IsActive))
            identity.AdvanceSecurityVersion();
    }

    private static void AddSystemAudit(FylkrenDbContext database, ExternalIdentityLink link,
        string eventType, DateTimeOffset now) =>
        database.AuditEvents.Add(AuditEvent.FromSystem(
            Guid.NewGuid(), "directory-lifecycle", eventType,
            "external-identity-link", link.Id, now));
}

internal sealed class DirectoryLifecycleWorker(
    DirectoryLifecycleSynchronizer synchronizer,
    FylkrenOptions options,
    ILogger<DirectoryLifecycleWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        if (!options.Authentication.DirectoryLifecycle.Enabled) return;
        await Task.Delay(TimeSpan.FromMinutes(1), stoppingToken);
        var interval = TimeSpan.FromMinutes(options.Authentication.DirectoryLifecycle.IntervalMinutes);
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                var summary = await synchronizer.RunOnceAsync(stoppingToken);
                if (summary.Checked > 0)
                    logger.LogInformation(
                        "Directory lifecycle synchronization completed; checked={Checked}; active={Active}; suspended={Suspended}; resumed={Resumed}; missingPending={MissingPending}; unavailable={Unavailable}",
                        summary.Checked, summary.Active, summary.Suspended, summary.Resumed,
                        summary.MissingPending, summary.Unavailable);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                return;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Directory lifecycle synchronization failed");
            }
            await Task.Delay(interval, stoppingToken);
        }
    }
}
