namespace Fylkren.Api.Federation;

// Per-installation transport identity. The private key is protected with the
// installation's persisted ASP.NET Data Protection key ring before storage.
internal sealed class FederationSigningIdentity
{
    private FederationSigningIdentity() { }

    internal FederationSigningIdentity(string publicKeySpki, string protectedPrivateKey, DateTimeOffset createdAt)
    {
        Key = 1;
        PublicKeySpki = publicKeySpki;
        ProtectedPrivateKey = protectedPrivateKey;
        CreatedAt = createdAt;
    }

    public int Key { get; private set; }
    public string PublicKeySpki { get; private set; } = string.Empty;
    public string ProtectedPrivateKey { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public Guid? PendingRotationId { get; private set; }
    public string? PendingPublicKeySpki { get; private set; }
    public string? PendingProtectedPrivateKey { get; private set; }
    public DateTimeOffset? PendingCreatedAt { get; private set; }
    public Guid? ActiveRotationId { get; private set; }
    public DateTimeOffset? RotationActivatedAt { get; private set; }

    internal void StageRotation(Guid rotationId, string publicKeySpki, string protectedPrivateKey,
        DateTimeOffset createdAt)
    {
        if (rotationId == Guid.Empty || string.IsNullOrWhiteSpace(publicKeySpki) ||
            string.IsNullOrWhiteSpace(protectedPrivateKey) || createdAt == default ||
            PendingRotationId is not null)
            throw new InvalidOperationException("A valid, single pending federation key rotation is required.");
        PendingRotationId = rotationId;
        PendingPublicKeySpki = publicKeySpki;
        PendingProtectedPrivateKey = protectedPrivateKey;
        PendingCreatedAt = createdAt;
    }

    internal void ActivateRotation(Guid rotationId)
    {
        if (PendingRotationId != rotationId || PendingPublicKeySpki is null ||
            PendingProtectedPrivateKey is null || PendingCreatedAt is null)
            throw new InvalidOperationException("The pending federation key rotation does not match.");
        PublicKeySpki = PendingPublicKeySpki;
        ProtectedPrivateKey = PendingProtectedPrivateKey;
        CreatedAt = PendingCreatedAt.Value;
        PendingRotationId = null;
        PendingPublicKeySpki = null;
        PendingProtectedPrivateKey = null;
        PendingCreatedAt = null;
        ActiveRotationId = rotationId;
        RotationActivatedAt = DateTimeOffset.UtcNow;
    }

    internal void CompleteRotation(Guid rotationId)
    {
        if (ActiveRotationId != rotationId)
            throw new InvalidOperationException("The active federation key rotation does not match.");
        ActiveRotationId = null;
        RotationActivatedAt = null;
    }

    internal void ReprotectPrivateKey(string protectedPrivateKey) =>
        ProtectedPrivateKey = string.IsNullOrWhiteSpace(protectedPrivateKey)
            ? throw new ArgumentException("A protected federation key is required.") : protectedPrivateKey;

    internal void ReprotectPendingPrivateKey(string protectedPrivateKey)
    {
        if (PendingProtectedPrivateKey is null || string.IsNullOrWhiteSpace(protectedPrivateKey))
            throw new InvalidOperationException("No pending federation key is available for re-protection.");
        PendingProtectedPrivateKey = protectedPrivateKey;
    }

    internal void Recover(string publicKeySpki, string protectedPrivateKey,
        DateTimeOffset recoveredAt)
    {
        if (string.IsNullOrWhiteSpace(publicKeySpki) ||
            string.IsNullOrWhiteSpace(protectedPrivateKey) || recoveredAt == default)
            throw new InvalidOperationException("A valid federation recovery key is required.");
        PublicKeySpki = publicKeySpki;
        ProtectedPrivateKey = protectedPrivateKey;
        CreatedAt = recoveredAt;
        PendingRotationId = null;
        PendingPublicKeySpki = null;
        PendingProtectedPrivateKey = null;
        PendingCreatedAt = null;
        ActiveRotationId = null;
        RotationActivatedAt = null;
    }
}
