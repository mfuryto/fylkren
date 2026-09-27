using System.Security.Cryptography;

namespace Fylkren.Api.Identity;

public sealed class LoginIdentity
{
    private LoginIdentity() { }

    public LoginIdentity(Guid id, Guid personId, string username, bool isPlatformManager, DateTimeOffset createdAt)
    {
        Id = id;
        PersonId = personId;
        Username = username.Trim();
        NormalizedUsername = Username.ToUpperInvariant();
        IsPlatformManager = isPlatformManager;
        CreatedAt = createdAt;
        IsActive = true;
    }

    public Guid Id { get; private set; }
    public Guid PersonId { get; private set; }
    public string Username { get; private set; } = string.Empty;
    public string NormalizedUsername { get; private set; } = string.Empty;
    public string PasswordHash { get; private set; } = string.Empty;
    public bool IsPlatformManager { get; private set; }
    public bool MustChangePassword { get; private set; }
    public long SecurityVersion { get; private set; }
    public string? TotpSecret { get; private set; }
    public string? RecoveryCodeHashes { get; private set; }
    public long? LastTotpTimeStep { get; private set; }
    public bool TotpEnabled { get; private set; }
    public bool IsActive { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? LastSignedInAt { get; private set; }
    public int FailedAuthenticationCount { get; private set; }
    public DateTimeOffset? AuthenticationLockedUntil { get; private set; }
    public Person Person { get; private set; } = null!;

    public void SetPasswordHash(string passwordHash, bool mustChangePassword = false)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(passwordHash);
        PasswordHash = passwordHash;
        MustChangePassword = mustChangePassword;
        SecurityVersion++;
    }

    public void Update(string username, bool isActive)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(username);
        Username = username.Trim();
        NormalizedUsername = Username.ToUpperInvariant();
        IsActive = isActive;
    }

    public void Delete()
    {
        Username = $"deleted-{Id:N}";
        NormalizedUsername = Username.ToUpperInvariant();
        PasswordHash = string.Empty;
        MustChangePassword = false;
        TotpSecret = null;
        RecoveryCodeHashes = null;
        LastTotpTimeStep = null;
        TotpEnabled = false;
        IsActive = false;
        SecurityVersion++;
    }

    public void EnableTotp(string protectedSecret, IEnumerable<string> recoveryCodeHashes)
    {
        TotpSecret = protectedSecret;
        RecoveryCodeHashes = string.Join(';', recoveryCodeHashes);
        LastTotpTimeStep = null;
        TotpEnabled = true;
        SecurityVersion++;
    }

    public void DisableTotp()
    {
        TotpSecret = null;
        RecoveryCodeHashes = null;
        LastTotpTimeStep = null;
        TotpEnabled = false;
        SecurityVersion++;
    }

    public void AdvanceSecurityVersion() => SecurityVersion++;

    public void RecordSignIn(DateTimeOffset now) => LastSignedInAt = now;

    public bool IsAuthenticationLocked(DateTimeOffset now) => AuthenticationLockedUntil > now;

    public void RecordAuthenticationFailure(DateTimeOffset now)
    {
        if (AuthenticationLockedUntil <= now)
        {
            FailedAuthenticationCount = 0;
            AuthenticationLockedUntil = null;
        }
        FailedAuthenticationCount++;
        if (FailedAuthenticationCount >= 20)
            AuthenticationLockedUntil = now.AddMinutes(15);
    }

    public void ClearAuthenticationFailures()
    {
        FailedAuthenticationCount = 0;
        AuthenticationLockedUntil = null;
    }

    public bool ConsumeRecoveryCode(string hash)
    {
        var values = (RecoveryCodeHashes ?? "").Split(';', StringSplitOptions.RemoveEmptyEntries).ToList();
        byte[] candidate;
        try { candidate = Convert.FromHexString(hash); }
        catch (FormatException) { return false; }
        var index = values.FindIndex(value =>
        {
            try { return CryptographicOperations.FixedTimeEquals(Convert.FromHexString(value), candidate); }
            catch (FormatException) { return false; }
        });
        if (index < 0) return false;
        values.RemoveAt(index);
        RecoveryCodeHashes = string.Join(';', values);
        return true;
    }

    public bool ConsumeTotpTimeStep(long timeStep)
    {
        if (LastTotpTimeStep is not null && timeStep <= LastTotpTimeStep) return false;
        LastTotpTimeStep = timeStep;
        return true;
    }
}
