namespace Fylkren.Api.Identity;

public sealed class ExternalIdentityLink
{
    private ExternalIdentityLink() { }
    public ExternalIdentityLink(Guid id, Guid personId, string provider, string subjectId, string? username, DateTimeOffset createdAt)
        : this(id, personId, provider, "", subjectId, username, createdAt) { }
    public ExternalIdentityLink(Guid id, Guid personId, string provider, string providerInstanceId, string subjectId, string? username, DateTimeOffset createdAt)
    {
        Id = id; PersonId = personId; Provider = provider.Trim().ToLowerInvariant();
        ProviderInstanceId = providerInstanceId.Trim(); SubjectId = subjectId.Trim();
        Username = string.IsNullOrWhiteSpace(username) ? null : username.Trim(); CreatedAt = createdAt; IsActive = true;
        DirectoryAccessEnabled = true; DirectoryLifecycleStatus = "active"; DirectoryLastCheckedAt = createdAt;
        DirectoryLastSuccessfulSyncAt = createdAt;
    }
    public Guid Id { get; private set; }
    public Guid PersonId { get; private set; }
    public string Provider { get; private set; } = "";
    public string ProviderInstanceId { get; private set; } = "";
    public string SubjectId { get; private set; } = "";
    public string? Username { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public bool DirectoryAccessEnabled { get; private set; } = true;
    public string DirectoryLifecycleStatus { get; private set; } = "pending";
    public int DirectoryMissingCount { get; private set; }
    public DateTimeOffset? DirectoryLastCheckedAt { get; private set; }
    public DateTimeOffset? DirectoryLastSuccessfulSyncAt { get; private set; }
    public DateTimeOffset? DirectorySuspendedAt { get; private set; }
    public Person Person { get; private set; } = null!;
    public void UpdateUsername(string? username) => Username = string.IsNullOrWhiteSpace(username) ? null : username.Trim();
    public void BindLegacyProviderInstance(string providerInstanceId)
    {
        if (Provider is not ("oidc" or "saml") || ProviderInstanceId.Length > 0)
            throw new InvalidOperationException("Only an unbound legacy OIDC or SAML link can be bound.");
        ProviderInstanceId = providerInstanceId.Trim();
    }
    public void Reactivate(Guid personId, string? username, DateTimeOffset now)
    {
        PersonId = personId;
        UpdateUsername(username);
        IsActive = true;
        DirectoryAccessEnabled = true;
        DirectoryLifecycleStatus = "active";
        DirectoryMissingCount = 0;
        DirectoryLastCheckedAt = now;
        DirectoryLastSuccessfulSyncAt = now;
        DirectorySuspendedAt = null;
    }
    public void Deactivate() => IsActive = false;
    public bool RecordDirectoryActive(string? username, DateTimeOffset now)
    {
        var resumed = !DirectoryAccessEnabled;
        UpdateUsername(username);
        DirectoryAccessEnabled = true;
        DirectoryLifecycleStatus = "active";
        DirectoryMissingCount = 0;
        DirectoryLastCheckedAt = now;
        DirectoryLastSuccessfulSyncAt = now;
        DirectorySuspendedAt = null;
        return resumed;
    }
    public bool RecordDirectoryDisabled(string reason, DateTimeOffset now)
    {
        var suspended = DirectoryAccessEnabled;
        DirectoryAccessEnabled = false;
        DirectoryLifecycleStatus = reason;
        DirectoryMissingCount = 0;
        DirectoryLastCheckedAt = now;
        DirectoryLastSuccessfulSyncAt = now;
        DirectorySuspendedAt ??= now;
        return suspended;
    }
    public bool RecordDirectoryMissing(DateTimeOffset now, int confirmationCount)
    {
        ArgumentOutOfRangeException.ThrowIfLessThan(confirmationCount, 1);
        DirectoryMissingCount = Math.Clamp(DirectoryMissingCount, 0, confirmationCount - 1) + 1;
        DirectoryLastCheckedAt = now;
        if (DirectoryMissingCount < confirmationCount)
        {
            DirectoryLifecycleStatus = "missing-pending";
            return false;
        }
        var suspended = DirectoryAccessEnabled;
        DirectoryAccessEnabled = false;
        DirectoryLifecycleStatus = "missing";
        DirectorySuspendedAt ??= now;
        return suspended;
    }
    public void RecordDirectoryUnavailable(DateTimeOffset now)
    {
        DirectoryMissingCount = 0;
        DirectoryLastCheckedAt = now;
        DirectoryLifecycleStatus = "unavailable";
    }
}
