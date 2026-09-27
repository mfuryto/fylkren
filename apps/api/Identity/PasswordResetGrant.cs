using System.Security.Cryptography;
using System.Text;

namespace Fylkren.Api.Identity;

public sealed class PasswordResetGrant
{
    private PasswordResetGrant() { }

    public PasswordResetGrant(Guid id, Guid loginIdentityId, Guid createdByPersonId, byte[] codeHash, DateTimeOffset createdAt, DateTimeOffset expiresAt)
    {
        Id = id;
        LoginIdentityId = loginIdentityId;
        CreatedByPersonId = createdByPersonId;
        CodeHash = codeHash;
        CreatedAt = createdAt;
        ExpiresAt = expiresAt;
    }

    public Guid Id { get; private set; }
    public Guid LoginIdentityId { get; private set; }
    public Guid CreatedByPersonId { get; private set; }
    public byte[] CodeHash { get; private set; } = [];
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset ExpiresAt { get; private set; }
    public DateTimeOffset? ConsumedAt { get; private set; }
    public DateTimeOffset? RevokedAt { get; private set; }
    public LoginIdentity LoginIdentity { get; private set; } = null!;

    public bool Matches(string code, DateTimeOffset now) =>
        ConsumedAt is null && RevokedAt is null && ExpiresAt > now &&
        CryptographicOperations.FixedTimeEquals(CodeHash, Hash(code));

    public void Consume(DateTimeOffset now) => ConsumedAt = now;
    public void Revoke(DateTimeOffset now) => RevokedAt ??= now;

    public static byte[] Hash(string code) => SHA256.HashData(Encoding.UTF8.GetBytes(Normalize(code)));
    public static string Normalize(string code) => code.Replace("-", "", StringComparison.Ordinal).Trim().ToUpperInvariant();
}
