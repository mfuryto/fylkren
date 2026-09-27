namespace Fylkren.Api.Platform;

public sealed class ApiMachineIdentity
{
    private ApiMachineIdentity() { }
    public ApiMachineIdentity(Guid id, string name, string keyId, byte[] salt, byte[] secretHash, string scopes, DateTimeOffset? expiresAt, DateTimeOffset createdAt)
    { Id = id; Name = name.Trim(); KeyId = keyId; Salt = salt; SecretHash = secretHash; Scopes = scopes; ExpiresAt = expiresAt; CreatedAt = createdAt; IsActive = true; }
    public Guid Id { get; private set; }
    public string Name { get; private set; } = "";
    public string KeyId { get; private set; } = "";
    public byte[] Salt { get; private set; } = [];
    public byte[] SecretHash { get; private set; } = [];
    public string Scopes { get; private set; } = "";
    public DateTimeOffset? ExpiresAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? LastUsedAt { get; private set; }
    public bool IsActive { get; private set; }
    public void MarkUsed(DateTimeOffset now) => LastUsedAt = now;
    public void Deactivate() => IsActive = false;
}
