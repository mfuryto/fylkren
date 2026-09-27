namespace Fylkren.Api.Identity;

public sealed class WebAuthnFlowGrant
{
    private WebAuthnFlowGrant() { }

    public WebAuthnFlowGrant(Guid id, string purpose, DateTimeOffset createdAt, DateTimeOffset expiresAt)
    {
        Id = id;
        Purpose = purpose;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
    }

    public Guid Id { get; private set; }
    public string Purpose { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? ConsumedAt { get; private set; }
}
