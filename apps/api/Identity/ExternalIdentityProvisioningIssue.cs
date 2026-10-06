namespace Fylkren.Api.Identity;

public sealed class ExternalIdentityProvisioningIssue
{
    private ExternalIdentityProvisioningIssue() { }

    public ExternalIdentityProvisioningIssue(Guid id, string provider, string providerInstanceId,
        string subjectId, string? username, string? displayName, string? email, string reason,
        DateTimeOffset now)
    {
        Id = id;
        Provider = provider;
        ProviderInstanceId = providerInstanceId;
        SubjectId = subjectId;
        FirstSeenAt = now;
        Update(username, displayName, email, reason, now);
    }

    public Guid Id { get; private set; }
    public string Provider { get; private set; } = "";
    public string ProviderInstanceId { get; private set; } = "";
    public string SubjectId { get; private set; } = "";
    public string? Username { get; private set; }
    public string? DisplayName { get; private set; }
    public string? Email { get; private set; }
    public string Reason { get; private set; } = "";
    public DateTimeOffset FirstSeenAt { get; private set; }
    public DateTimeOffset LastSeenAt { get; private set; }
    public DateTimeOffset? ResolvedAt { get; private set; }

    public void Update(string? username, string? displayName, string? email, string reason, DateTimeOffset now)
    {
        Username = username;
        DisplayName = displayName;
        Email = email;
        Reason = reason;
        LastSeenAt = now;
        ResolvedAt = null;
    }

    public void Resolve(DateTimeOffset now) => ResolvedAt ??= now;
}
