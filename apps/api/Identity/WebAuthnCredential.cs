namespace Fylkren.Api.Identity;

public sealed class WebAuthnCredential
{
    private WebAuthnCredential() { }
    public WebAuthnCredential(Guid id, Guid personId, byte[] credentialId, byte[] publicKey, byte[] userHandle, uint signCount, string name, DateTimeOffset createdAt)
    { Id = id; PersonId = personId; CredentialId = credentialId; PublicKey = publicKey; UserHandle = userHandle; SignCount = signCount; Name = name.Trim(); CreatedAt = createdAt; IsActive = true; }
    public Guid Id { get; private set; }
    public Guid PersonId { get; private set; }
    public byte[] CredentialId { get; private set; } = [];
    public byte[] PublicKey { get; private set; } = [];
    public byte[] UserHandle { get; private set; } = [];
    public uint SignCount { get; private set; }
    public string Name { get; private set; } = "";
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? LastUsedAt { get; private set; }
    public Person Person { get; private set; } = null!;
    public void Used(uint signCount, DateTimeOffset at) { SignCount = signCount; LastUsedAt = at; }
    public void Deactivate() => IsActive = false;
}
