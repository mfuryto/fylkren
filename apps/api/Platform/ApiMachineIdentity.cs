namespace Fylkren.Api.Platform;

public sealed class ApiMachineIdentity
{
    public const string BearerV1 = "bearer-v1";
    public const string SignedV2 = "signed-v2";

    private ApiMachineIdentity() { }
    public ApiMachineIdentity(Guid id, string name, string keyId, byte[] salt, byte[] secretHash, string scopes, DateTimeOffset? expiresAt, DateTimeOffset createdAt)
        : this(id, name, keyId, salt, secretHash, ApiMachineSecrets.LegacyAlgorithm,
            ApiMachineSecrets.LegacyVersion, ApiMachineSecrets.LegacyIterations, scopes, expiresAt, createdAt) { }
    public ApiMachineIdentity(Guid id, string name, string keyId, byte[] salt, byte[] secretHash,
        string secretAlgorithm, int secretHashVersion, int secretIterations, string scopes,
        DateTimeOffset? expiresAt, DateTimeOffset createdAt)
    { Id = id; Name = name.Trim(); KeyId = keyId; Salt = salt; SecretHash = secretHash; SecretAlgorithm = secretAlgorithm; SecretHashVersion = secretHashVersion; SecretIterations = secretIterations; AuthenticationMode = BearerV1; LegacyBearerAcceptedUntil = expiresAt is { } expiry && expiry < createdAt.AddDays(90) ? expiry : createdAt.AddDays(90); Scopes = scopes; ExpiresAt = expiresAt; CreatedAt = createdAt; IsActive = true; }
    public ApiMachineIdentity(Guid id, string name, string keyId, byte[] publicKey, string signatureAlgorithm,
        string scopes, DateTimeOffset expiresAt, DateTimeOffset createdAt)
    { Id = id; Name = name.Trim(); KeyId = keyId; Salt = []; SecretHash = []; SecretAlgorithm = ApiMachineSecrets.CurrentAlgorithm; SecretHashVersion = ApiMachineSecrets.CurrentVersion; SecretIterations = ApiMachineSecrets.CurrentIterations; AuthenticationMode = SignedV2; PublicKey = publicKey; SignatureAlgorithm = signatureAlgorithm; Scopes = scopes; ExpiresAt = expiresAt; CreatedAt = createdAt; IsActive = true; }
    public Guid Id { get; private set; }
    public string Name { get; private set; } = "";
    public string KeyId { get; private set; } = "";
    public byte[] Salt { get; private set; } = [];
    public byte[] SecretHash { get; private set; } = [];
    public string SecretAlgorithm { get; private set; } = ApiMachineSecrets.LegacyAlgorithm;
    public int SecretHashVersion { get; private set; } = ApiMachineSecrets.LegacyVersion;
    public int SecretIterations { get; private set; } = ApiMachineSecrets.LegacyIterations;
    public string AuthenticationMode { get; private set; } = BearerV1;
    public byte[]? PublicKey { get; private set; }
    public string? SignatureAlgorithm { get; private set; }
    public DateTimeOffset? LegacyBearerAcceptedUntil { get; private set; }
    public string Scopes { get; private set; } = "";
    public DateTimeOffset? ExpiresAt { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? LastUsedAt { get; private set; }
    public bool IsActive { get; private set; }
    public void MarkUsed(DateTimeOffset now) => LastUsedAt = now;
    public void UpgradeSecret(byte[] salt, byte[] secretHash, string algorithm, int version, int iterations)
    { Salt = salt; SecretHash = secretHash; SecretAlgorithm = algorithm; SecretHashVersion = version; SecretIterations = iterations; }
    public void Deactivate() => IsActive = false;
}

public sealed class ApiMachineRequestNonce
{
    private ApiMachineRequestNonce() { }
    public ApiMachineRequestNonce(Guid machineIdentityId, string nonce, DateTimeOffset createdAt, DateTimeOffset expiresAt)
    { MachineIdentityId = machineIdentityId; Nonce = nonce; CreatedAt = createdAt; ExpiresAt = expiresAt; }
    public Guid MachineIdentityId { get; private set; }
    public string Nonce { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public ApiMachineIdentity MachineIdentity { get; private set; } = null!;
}
