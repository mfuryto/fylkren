namespace Fylkren.Api.Federation;

// A remote installation. A pinned key plus a successful proof represents local
// approval; routing additionally requires explicit reciprocal site grants.
internal sealed class FederationPeer
{
    private FederationPeer() { }

    internal FederationPeer(Guid instanceId, string name, string baseUrl, DateTimeOffset createdAt)
    {
        if (instanceId == Guid.Empty) throw new ArgumentException("Instance ID is required.", nameof(instanceId));
        ValidateDetails(name, baseUrl);
        InstanceId = instanceId;
        Name = name;
        BaseUrl = baseUrl;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public Guid InstanceId { get; private set; }
    public string Name { get; private set; } = string.Empty;
    public string BaseUrl { get; private set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; private set; }
    public bool IsActive { get; private set; }
    public string? PinnedPublicKeySpki { get; private set; }
    public string? PendingPinnedPublicKeySpki { get; private set; }
    public Guid? PendingKeyRotationId { get; private set; }
    public DateTimeOffset? KeyRotationStagedAt { get; private set; }
    public Guid? LastCompletedKeyRotationId { get; private set; }
    public DateTimeOffset? LastProofAt { get; private set; }

    internal void Update(string name, string baseUrl)
    {
        ValidateDetails(name, baseUrl);
        if (BaseUrl != baseUrl) LastProofAt = null;
        Name = name;
        BaseUrl = baseUrl;
    }

    internal void Deactivate() => IsActive = false;

    internal void PinPublicKey(string publicKeySpki)
    {
        if (PinnedPublicKeySpki is not null && PinnedPublicKeySpki != publicKeySpki)
            throw new InvalidOperationException("A pinned key cannot be replaced without a rotation procedure.");
        PinnedPublicKeySpki = publicKeySpki;
    }

    internal void RecordProof(DateTimeOffset at) => LastProofAt = at;

    internal void StageKeyRotation(Guid rotationId, string currentPublicKeySpki,
        string newPublicKeySpki, DateTimeOffset at)
    {
        if (rotationId == Guid.Empty || PinnedPublicKeySpki != currentPublicKeySpki ||
            currentPublicKeySpki == newPublicKeySpki || PendingPinnedPublicKeySpki is not null)
            throw new InvalidOperationException("The peer key rotation cannot be staged.");
        PendingPinnedPublicKeySpki = newPublicKeySpki;
        PendingKeyRotationId = rotationId;
        KeyRotationStagedAt = at;
    }

    internal bool CompleteKeyRotation(Guid rotationId, DateTimeOffset provedAt)
    {
        if (PendingKeyRotationId is null && LastCompletedKeyRotationId == rotationId)
            return false;
        if (PendingKeyRotationId != rotationId || PendingPinnedPublicKeySpki is null)
            throw new InvalidOperationException("The peer key rotation cannot be completed.");
        PinnedPublicKeySpki = PendingPinnedPublicKeySpki;
        PendingPinnedPublicKeySpki = null;
        PendingKeyRotationId = null;
        KeyRotationStagedAt = null;
        LastCompletedKeyRotationId = rotationId;
        LastProofAt = provedAt;
        return true;
    }

    internal void RecoverPinnedKey(string publicKeySpki, DateTimeOffset provedAt)
    {
        if (string.IsNullOrWhiteSpace(publicKeySpki) || publicKeySpki == PinnedPublicKeySpki ||
            provedAt == default)
            throw new InvalidOperationException("A different proved federation recovery key is required.");
        PinnedPublicKeySpki = publicKeySpki;
        PendingPinnedPublicKeySpki = null;
        PendingKeyRotationId = null;
        KeyRotationStagedAt = null;
        LastCompletedKeyRotationId = null;
        LastProofAt = provedAt;
    }

    private static void ValidateDetails(string name, string baseUrl)
    {
        if (string.IsNullOrWhiteSpace(name) || name.Length > 120 ||
            string.IsNullOrWhiteSpace(baseUrl) || baseUrl.Length > 2048)
            throw new ArgumentException("Peer details are invalid.");
    }
}
