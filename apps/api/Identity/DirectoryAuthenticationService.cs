using System.DirectoryServices.Protocols;
using System.Net;
using System.Text;
using Fylkren.Api.Platform;

namespace Fylkren.Api.Identity;

public sealed record DirectoryUser(string Provider, string StableId, string Username, string DistinguishedName, string? DisplayName, string? Email);

public sealed class DirectoryAuthenticationService(FylkrenOptions options)
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
            using var connection = CreateConnection(settings, new NetworkCredential(user.DistinguishedName, password));
            connection.Bind();
            return user;
        }
        catch (LdapException) { return null; }
    }

    private DirectoryUser? FindUser(string provider, string username) => FindUser(GetSettings(provider), username);

    private IReadOnlyList<DirectoryUser> SearchUsers(string provider, string query, int limit)
    {
        if (string.IsNullOrWhiteSpace(query) || query.Trim().Length < 2 || query.Length > 100) return [];
        var settings = GetSettings(provider);
        try
        {
            using var connection = CreateConnection(settings, new NetworkCredential(settings.BindDn, settings.BindPassword));
            connection.Bind();
            var value = EscapeFilterValue(query.Trim());
            var filter = $"(|({settings.UsernameAttribute}=*{value}*)({settings.DisplayNameAttribute}=*{value}*)({settings.EmailAttribute}=*{value}*))";
            var request = new SearchRequest(settings.SearchBase, filter, SearchScope.Subtree,
                settings.UsernameAttribute, settings.StableIdAttribute, settings.DisplayNameAttribute, settings.EmailAttribute)
            { SizeLimit = Math.Clamp(limit, 1, 20) };
            var response = (SearchResponse)connection.SendRequest(request, TimeSpan.FromSeconds(10));
            return response.Entries.Cast<SearchResultEntry>()
                .Select(entry => ReadUser(entry, settings))
                .Where(user => user is not null)
                .Select(user => user!)
                .OrderBy(user => user.DisplayName ?? user.Username, StringComparer.CurrentCultureIgnoreCase)
                .ToList();
        }
        catch (LdapException) { return []; }
        catch (DirectoryOperationException) { return []; }
    }

    private static DirectoryUser? FindUser(Settings settings, string username)
    {
        if (string.IsNullOrWhiteSpace(username) || username.Length > 256) return null;
        try
        {
            using var connection = CreateConnection(settings, new NetworkCredential(settings.BindDn, settings.BindPassword));
            connection.Bind();
            var filter = $"({settings.UsernameAttribute}={EscapeFilterValue(username.Trim())})";
            var request = new SearchRequest(settings.SearchBase, filter, SearchScope.Subtree,
                settings.UsernameAttribute, settings.StableIdAttribute, settings.DisplayNameAttribute, settings.EmailAttribute);
            var response = (SearchResponse)connection.SendRequest(request, TimeSpan.FromSeconds(10));
            if (response.Entries.Count != 1) return null;
            var entry = response.Entries[0];
            return ReadUser(entry, settings);
        }
        catch (LdapException) { return null; }
        catch (DirectoryOperationException) { return null; }
    }

    private static DirectoryUser? ReadUser(SearchResultEntry entry, Settings settings)
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
        return new DirectoryUser(settings.Provider, stableId!, resolvedUsername!, entry.DistinguishedName,
            displayName, email);
    }

    private static bool ValidDirectoryText(string? value, int maximumLength) =>
        !string.IsNullOrWhiteSpace(value) && value.Length <= maximumLength &&
        value.All(character => !char.IsControl(character));

    private bool TestConnection(string provider)
    {
        try
        {
            var settings = GetSettings(provider);
            using var connection = CreateConnection(settings, new NetworkCredential(settings.BindDn, settings.BindPassword));
            connection.Bind();
            var request = new SearchRequest(settings.BaseDn, "(objectClass=*)", SearchScope.Base, "dn");
            _ = connection.SendRequest(request, TimeSpan.FromSeconds(10));
            return true;
        }
        catch (LdapException) { return false; }
        catch (DirectoryOperationException) { return false; }
    }

    private Settings GetSettings(string provider)
    {
        DirectoryOptionsBase source = provider.ToLowerInvariant() switch
        {
            "ad" when options.Authentication.ActiveDirectory.Enabled => options.Authentication.ActiveDirectory,
            "ldap" when options.Authentication.Ldap.Enabled => options.Authentication.Ldap,
            _ => throw new InvalidOperationException("Directory provider is not enabled.")
        };
        return new Settings(provider.ToLowerInvariant(), source.Server!, source.Port, source.UseSsl, source.UseStartTls,
            source.BaseDn!, string.IsNullOrWhiteSpace(source.UserSearchBase) ? source.BaseDn! : source.UserSearchBase!,
            source.BindDn!, source.BindPassword!, source.UsernameAttribute, source.DisplayNameAttribute,
            source.EmailAttribute, source.StableIdAttribute);
    }

    private static LdapConnection CreateConnection(Settings settings, NetworkCredential credential)
    {
        var identifier = new LdapDirectoryIdentifier(settings.Server, settings.Port, false, false);
        var connection = new LdapConnection(identifier, credential, AuthType.Basic) { Timeout = TimeSpan.FromSeconds(10) };
        connection.SessionOptions.ProtocolVersion = 3;
        connection.SessionOptions.ReferralChasing = ReferralChasingOptions.None;
        if (settings.UseSsl) connection.SessionOptions.SecureSocketLayer = true;
        if (settings.UseStartTls) connection.SessionOptions.StartTransportLayerSecurity(null);
        return connection;
    }

    private static string? ReadStableId(SearchResultEntry entry, Settings settings)
    {
        var value = ReadValue(entry, settings.StableIdAttribute);
        if (value is null) return null;
        if (settings.Provider == "ad" && value is byte[] bytes && bytes.Length == 16) return new Guid(bytes).ToString("D");
        return value is byte[] binary ? Encoding.UTF8.GetString(binary).Trim().ToLowerInvariant() : value.ToString()?.Trim().ToLowerInvariant();
    }

    private static string? ReadText(SearchResultEntry entry, string attribute) => ReadValue(entry, attribute) switch
    {
        byte[] bytes => Encoding.UTF8.GetString(bytes).Trim(),
        { } value => value.ToString()?.Trim(),
        _ => null
    };

    private static object? ReadValue(SearchResultEntry entry, string attribute) =>
        entry.Attributes.Contains(attribute) && entry.Attributes[attribute].Count > 0 ? entry.Attributes[attribute][0] : null;

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
        string DisplayNameAttribute, string EmailAttribute, string StableIdAttribute);
}
