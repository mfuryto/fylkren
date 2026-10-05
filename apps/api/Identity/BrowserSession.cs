namespace Fylkren.Api.Identity;

public sealed class BrowserSession
{
    private BrowserSession() { }

    public BrowserSession(Guid id, Guid loginIdentityId, long securityVersion, string authenticationMethod,
        string userAgent, DateTimeOffset createdAt, DateTimeOffset expiresAt)
    {
        if (id == Guid.Empty || loginIdentityId == Guid.Empty) throw new ArgumentException("A browser session requires an identity.");
        if (securityVersion < 0) throw new ArgumentOutOfRangeException(nameof(securityVersion));
        if (string.IsNullOrWhiteSpace(authenticationMethod) || authenticationMethod.Length > 40)
            throw new ArgumentException("A bounded authentication method is required.", nameof(authenticationMethod));
        if (expiresAt <= createdAt) throw new ArgumentOutOfRangeException(nameof(expiresAt));
        Id = id;
        LoginIdentityId = loginIdentityId;
        SecurityVersion = securityVersion;
        AuthenticationMethod = authenticationMethod.Trim();
        UserAgent = userAgent.Length > 300 ? userAgent[..300] : userAgent;
        CreatedAt = createdAt;
        LastSeenAt = createdAt;
        ExpiresAt = expiresAt;
    }

    public Guid Id { get; private set; }
    public Guid LoginIdentityId { get; private set; }
    public long SecurityVersion { get; private set; }
    public string AuthenticationMethod { get; private set; } = string.Empty;
    public string UserAgent { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset LastSeenAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public LoginIdentity LoginIdentity { get; private set; } = null!;

    public bool IsActive(DateTimeOffset now, long currentSecurityVersion) =>
        RevokedAt is null && ExpiresAt > now && SecurityVersion == currentSecurityVersion;

    public void Seen(DateTimeOffset now)
    {
        if (RevokedAt is null && now > LastSeenAt) LastSeenAt = now;
    }

    public void Revoke(DateTimeOffset now)
    {
        if (RevokedAt is null) RevokedAt = now;
    }
}
