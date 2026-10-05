using System.Net;
using System.Net.Sockets;
using System.Security.Authentication;
using System.Text;
using Fylkren.Api.Platform;
using Fylkren.Api.Networking;
using Novell.Directory.Ldap;

namespace Fylkren.Api.Identity;

public sealed record DirectoryUser(string Provider, string StableId, string Username, string DistinguishedName, string? DisplayName, string? Email);
public enum DirectoryAccountState { Active, Disabled, Missing, Unavailable }
public sealed record DirectoryLifecycleResult(DirectoryAccountState State, DirectoryUser? User, string Status);

public sealed class DirectoryAuthenticationService(FylkrenOptions options, ServiceDestinationPolicy destinations)
{
    private const int MaximumConcurrentOperations = 8;
    private readonly SemaphoreSlim operationSlots = new(MaximumConcurrentOperations, MaximumConcurrentOperations);

    public Task<DirectoryUser?> FindUserAsync(string provider, string username, CancellationToken cancellationToken) =>
        RunBoundedAsync(() => FindUser(provider, username), cancellationToken);

    public Task<IReadOnlyList<DirectoryUser>> SearchUsersAsync(string provider, string query, int limit, CancellationToken cancellationToken) =>
        RunBoundedAsync<IReadOnlyList<DirectoryUser>>(() => SearchUsers(provider, query, limit), cancellationToken);

    public Task<DirectoryUser?> AuthenticateAsync(string provider, string username, string password, CancellationToken cancellationToken) =>
        RunBoundedAsync(() => Authenticate(provider, username, password), cancellationToken);

    public Task<bool> TestConnectionAsync(string provider, CancellationToken cancellationToken) =>
        RunBoundedAsync(() => TestConnection(provider), cancellationToken);

    public Task<bool> TestConfiguredConnectionAsync(string provider, CancellationToken cancellationToken) =>
        RunBoundedAsync(() => TestConnection(GetSettings(provider, requireEnabled: false)), cancellationToken);

    public Task<DirectoryLifecycleResult> LookupLifecycleAsync(string provider, string stableId,
        CancellationToken cancellationToken) =>
        RunBoundedAsync(() => LookupLifecycle(provider, stableId), cancellationToken);

    private async Task<T> RunBoundedAsync<T>(Func<T> operation, CancellationToken cancellationToken)
    {
        await operationSlots.WaitAsync(cancellationToken);
        try
        {
            return await Task.Run(operation, CancellationToken.None);
        }
        finally
        {
            operationSlots.Release();
        }
    }

    private DirectoryUser? Authenticate(string provider, string username, string password)
    {
        if (string.IsNullOrWhiteSpace(password)) return null;
        var settings = GetSettings(provider);
        var user = FindUser(settings, username);
        if (user is null) return null;
        try
        {
            using var connection = CreateConnection(settings);
            connection.BindAsync(user.DistinguishedName, password).GetAwaiter().GetResult();
            return user;
        }
        catch (LdapException) { return null; }
        catch (InvalidOperationException) { return null; }
        catch (ArgumentException) { return null; }
        catch (Exception error) when (IsTransportFailure(error)) { return null; }
    }

    private DirectoryUser? FindUser(string provider, string username) => FindUser(GetSettings(provider), username);

    private IReadOnlyList<DirectoryUser> SearchUsers(string provider, string query, int limit)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2 || query.Length > 100) return [];
        var settings = GetSettings(provider);
        try
        {
            using var connection = CreateConnection(settings);
            connection.BindAsync(settings.BindDn, settings.BindPassword).GetAwaiter().GetResult();
            var value = EscapeFilterValue(query.Trim());
            var filter = $"(|({settings.UsernameAttribute}=*{value}*)({settings.DisplayNameAttribute}=*{value}*)({settings.EmailAttribute}=*{value}*))";
            var entries = Search(connection, settings.SearchBase, LdapConnection.ScopeSub, filter,
                Math.Clamp(limit, 1, 20), settings.UsernameAttribute, settings.StableIdAttribute,
                settings.DisplayNameAttribute, settings.EmailAttribute);
            return entries
                .Select(entry => ReadUser(entry, settings))
                .Where(user => user is not null)
                .Select(user => user!)
                .OrderBy(user => user.DisplayName ?? user.Username, StringComparer.CurrentCultureIgnoreCase)
                .ToList();
        }
        catch (LdapException) { return []; }
        catch (InvalidOperationException) { return []; }
        catch (ArgumentException) { return []; }
        catch (Exception error) when (IsTransportFailure(error)) { return []; }
    }

    private DirectoryUser? FindUser(Settings settings, string username)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length > 256) return null;
        try
        {
            using var connection = CreateConnection(settings);
            connection.BindAsync(settings.BindDn, settings.BindPassword).GetAwaiter().GetResult();
            var filter = $"({settings.UsernameAttribute}={EscapeFilterValue(username.Trim())})";
            var entries = Search(connection, settings.SearchBase, LdapConnection.ScopeSub, filter, 2,
                settings.UsernameAttribute, settings.StableIdAttribute, settings.DisplayNameAttribute,
                settings.EmailAttribute);
            if (entries.Count != 1) return null;
            var entry = entries[0];
            return ReadUser(entry, settings);
        }
        catch (LdapException) { return null; }
        catch (InvalidOperationException) { return null; }
        catch (ArgumentException) { return null; }
        catch (Exception error) when (IsTransportFailure(error)) { return null; }
    }

    private static DirectoryUser? ReadUser(LdapEntry entry, Settings settings)
    {
        var stableId = ReadStableId(entry, settings)?.Trim();
        var resolvedUsername = ReadText(entry, settings.UsernameAttribute)?.Trim();
        var displayName = ReadText(entry, settings.DisplayNameAttribute)?.Trim();
        var email = ReadText(entry, settings.EmailAttribute)?.Trim();
        if (string.IsNullOrWhiteSpace(displayName)) displayName = null;
        if (string.IsNullOrWhiteSpace(email)) email = null;
        if (!ValidDirectoryText(stableId, 256) || !ValidDirectoryText(resolvedUsername, 256) ||
            displayName is not null && !ValidDirectoryText(displayName, 200) ||
            displayName is null && resolvedUsername!.Length > 200)
            return null;
        if (email is not null && !ValidDirectoryText(email, 254)) email = null;
        return new DirectoryUser(settings.Provider, stableId!, resolvedUsername!, entry.Dn,
            displayName, email);
    }

    private static bool ValidDirectoryText(string? value, int maximumLength) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= maximumLength &&
        value.All(character => !char.IsControl(character));

    private bool TestConnection(string provider)
    {
        try
        {
            return TestConnection(GetSettings(provider));
        }
        catch (InvalidOperationException) { return false; }
    }

    private bool TestConnection(Settings settings)
    {
        try
        {
            using var connection = CreateConnection(settings);
            connection.BindAsync(settings.BindDn, settings.BindPassword).GetAwaiter().GetResult();
            var entries = Search(connection, settings.BaseDn, LdapConnection.ScopeBase, "(objectClass=*)", 2, "dn");
            return entries.Count == 1;
        }
        catch (LdapException) { return false; }
        catch (InvalidOperationException) { return false; }
        catch (ArgumentException) { return false; }
        catch (Exception error) when (IsTransportFailure(error)) { return false; }
    }

    private DirectoryLifecycleResult LookupLifecycle(string provider, string stableId)
    {
        Settings settings;
        try { settings = GetSettings(provider); }
        catch (InvalidOperationException) { return new(DirectoryAccountState.Unavailable, null, "provider-disabled"); }
        if (string.IsNullOrWhiteSpace(stableId) || stableId.Length > 256)
            return new(DirectoryAccountState.Unavailable, null, "invalid-stable-id");
        try
        {
            using var connection = CreateConnection(settings);
            connection.BindAsync(settings.BindDn, settings.BindPassword).GetAwaiter().GetResult();
            var stableFilter = StableIdFilter(settings, stableId);
            if (stableFilter is null)
                return new(DirectoryAccountState.Unavailable, null, "invalid-stable-id");
            var attributes = new List<string>
            {
                settings.UsernameAttribute, settings.StableIdAttribute,
                settings.DisplayNameAttribute, settings.EmailAttribute
            };
            if (settings.Provider == "ad")
            {
                attributes.Add("userAccountControl");
                attributes.Add("accountExpires");
            }
            var entries = Search(connection, settings.SearchBase, LdapConnection.ScopeSub, stableFilter, 2,
                attributes.ToArray());
            if (entries.Count == 0)
                return new(DirectoryAccountState.Missing, null, "missing");
            if (entries.Count != 1)
                return new(DirectoryAccountState.Unavailable, null, "duplicate-stable-id");
            var entry = entries[0];
            var user = ReadUser(entry, settings);
            if (user is null || !string.Equals(user.StableId, stableId, StringComparison.OrdinalIgnoreCase))
                return new(DirectoryAccountState.Unavailable, null, "invalid-entry");

            if (settings.Provider == "ad")
            {
                if (!TryReadInt64(entry, "userAccountControl", out var control))
                    return new(DirectoryAccountState.Unavailable, user, "missing-account-status");
                if ((control & 0x2) != 0)
                    return new(DirectoryAccountState.Disabled, user, "disabled");
                if (TryReadInt64(entry, "accountExpires", out var expires) &&
                    expires is > 0 and < long.MaxValue &&
                    DateTimeOffset.FromFileTime(expires) <= DateTimeOffset.UtcNow)
                    return new(DirectoryAccountState.Disabled, user, "expired");
            }

            var activeEntries = Search(connection, entry.Dn, LdapConnection.ScopeBase,
                settings.LifecycleActiveFilter, 1, "dn");
            return activeEntries.Count == 1
                ? new(DirectoryAccountState.Active, user, "active")
                : new(DirectoryAccountState.Disabled, user, "inactive-filter");
        }
        catch (LdapReferralException) { return new(DirectoryAccountState.Unavailable, null, "referral-not-supported"); }
        catch (LdapException) { return new(DirectoryAccountState.Unavailable, null, "directory-unavailable"); }
        catch (InvalidOperationException) { return new(DirectoryAccountState.Unavailable, null, "directory-unavailable"); }
        catch (ArgumentOutOfRangeException) { return new(DirectoryAccountState.Unavailable, null, "invalid-account-expiry"); }
        catch (ArgumentException) { return new(DirectoryAccountState.Unavailable, null, "directory-unavailable"); }
        catch (Exception error) when (IsTransportFailure(error)) { return new(DirectoryAccountState.Unavailable, null, "directory-unavailable"); }
    }

    private static string? StableIdFilter(Settings settings, string stableId)
    {
        if (settings.Provider != "ad")
            return $"({settings.StableIdAttribute}={EscapeFilterValue(stableId.Trim())})";
        if (!Guid.TryParse(stableId, out var id)) return null;
        var binary = string.Concat(id.ToByteArray().Select(value => $"\\{value:x2}"));
        return $"({settings.StableIdAttribute}={binary})";
    }

    private static bool TryReadInt64(LdapEntry entry, string attribute, out long result)
    {
        return long.TryParse(ReadText(entry, attribute), out result);
    }

    private Settings GetSettings(string provider, bool requireEnabled = true)
    {
        DirectoryOptionsBase source = provider.ToLowerInvariant() switch
        {
            "ad" when !requireEnabled || options.Authentication.ActiveDirectory.Enabled => options.Authentication.ActiveDirectory,
            "ldap" when !requireEnabled || options.Authentication.Ldap.Enabled => options.Authentication.Ldap,
            _ => throw new InvalidOperationException("Directory provider is not enabled.")
        };
        return new Settings(provider.ToLowerInvariant(), source.Server!, source.Port, source.UseSsl, source.UseStartTls,
            source.BaseDn!, string.IsNullOrWhiteSpace(source.UserSearchBase) ? source.BaseDn! : source.UserSearchBase!,
            source.BindDn!, source.BindPassword!, source.UsernameAttribute, source.DisplayNameAttribute,
            source.EmailAttribute, source.StableIdAttribute, source.LifecycleActiveFilter);
    }

    private LdapConnection CreateConnection(Settings settings)
    {
        var approvedAddresses = destinations.ResolveAllowed(settings.Server);
        if (approvedAddresses.Length == 0)
            throw new InvalidOperationException("The configured directory destination is not allowed or available.");
        var approved = approvedAddresses.ToHashSet();
        var connectionOptions = new LdapConnectionOptions()
            .ConfigureIpAddressFilter(approved.Contains);
        if (settings.UseSsl) connectionOptions.UseSsl();
        var connection = new LdapConnection(connectionOptions) { ConnectionTimeout = 10_000 };
        try
        {
            connection.ConnectAsync(settings.Server, settings.Port).GetAwaiter().GetResult();
            if (settings.UseStartTls) connection.StartTlsAsync().GetAwaiter().GetResult();
            return connection;
        }
        catch
        {
            // A TLS handshake can fail before the client's reader/socket state is
            // fully initialized. Cleanup must not replace that controlled failure.
            try { connection.Dispose(); } catch { }
            throw;
        }
    }

    private static List<LdapEntry> Search(LdapConnection connection, string baseDn, int scope, string filter,
        int maximumResults, params string[] attributes)
    {
        var constraints = new LdapSearchConstraints
        {
            TimeLimit = 10_000,
            ServerTimeLimit = 10,
            MaxResults = maximumResults,
            ReferralFollowing = false
        };
        var results = connection.SearchAsync(baseDn, scope, filter, attributes, false, constraints)
            .GetAwaiter().GetResult();
        var entries = new List<LdapEntry>(maximumResults);
        while (results.HasMoreAsync().GetAwaiter().GetResult())
            entries.Add(results.NextAsync().GetAwaiter().GetResult());
        return entries;
    }

    private static string? ReadStableId(LdapEntry entry, Settings settings)
    {
        if (!entry.Contains(settings.StableIdAttribute)) return null;
        var attribute = entry.Get(settings.StableIdAttribute);
        if (settings.Provider == "ad")
        {
            var bytes = attribute.ByteValue;
            return bytes.Length == 16 ? new Guid(bytes).ToString("D") : null;
        }
        return attribute.StringValue?.Trim().ToLowerInvariant();
    }

    private static string? ReadText(LdapEntry entry, string attribute) =>
        entry.Contains(attribute) ? entry.Get(attribute).StringValue?.Trim() : null;

    private static bool IsTransportFailure(Exception error) =>
        error is AuthenticationException or IOException or SocketException or TimeoutException;

    internal static string EscapeFilterValue(string value)
    {
        var result = new StringBuilder(value.Length);
        foreach (var character in value)
        {
            result.Append(character switch
            {
                '*' => "\\2a",
                '(' => "\\28",
                ')' => "\\29",
                '\\' => "\\5c",
                '\0' => "\\00",
                _ => character.ToString()
            });
        }
        return result.ToString();
    }

    private sealed record Settings(string Provider, string Server, int Port, bool UseSsl, bool UseStartTls,
        string BaseDn, string SearchBase, string BindDn, string BindPassword, string UsernameAttribute,
        string DisplayNameAttribute, string EmailAttribute, string StableIdAttribute, string LifecycleActiveFilter);
}
