using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.DataProtection;
using Fylkren.Api.Platform;

namespace Fylkren.Api.Identity;

public sealed class TotpService(IDataProtectionProvider dataProtectionProvider)
{
    private readonly IDataProtector secretProtector = dataProtectionProvider.CreateProtector(ProtectedValuePurposes.TotpSecret);
    private readonly IDataProtector challengeProtector = dataProtectionProvider.CreateProtector("Fylkren.TotpChallenge.v2");
    private readonly IDataProtector setupProtector = dataProtectionProvider.CreateProtector("Fylkren.TotpSetup.v2");

    public string CreateSecret() => Base32(RandomNumberGenerator.GetBytes(20));
    public string ProtectSecret(string secret) => secretProtector.Protect(secret);
    public string UnprotectSecret(string secret) => secretProtector.Unprotect(secret);
    public string CreateSetupToken(Guid identityId, long securityVersion, string secret) =>
        setupProtector.Protect($"{identityId:N}|{securityVersion}|{secret}|{DateTimeOffset.UtcNow.AddMinutes(10).ToUnixTimeSeconds()}");
    public (Guid IdentityId, long SecurityVersion, string Secret) ReadSetupToken(string token)
    {
        var values = setupProtector.Unprotect(token).Split('|');
        if (values.Length != 4 || !Guid.TryParseExact(values[0], "N", out var identityId) ||
            !long.TryParse(values[1], out var securityVersion) ||
            !long.TryParse(values[3], out var expires) || expires < DateTimeOffset.UtcNow.ToUnixTimeSeconds())
            throw new CryptographicException();
        return (identityId, securityVersion, values[2]);
    }
    public string CreateChallenge(Guid identityId, long securityVersion, TimeSpan lifetime) => challengeProtector.Protect($"{identityId:N}|{securityVersion}|{DateTimeOffset.UtcNow.Add(lifetime).ToUnixTimeSeconds()}");
    public (Guid IdentityId, long SecurityVersion) ReadChallenge(string challenge)
    {
        var values = challengeProtector.Unprotect(challenge).Split('|');
        if (values.Length != 3 || !Guid.TryParseExact(values[0], "N", out var identityId) || !long.TryParse(values[1], out var securityVersion) || !long.TryParse(values[2], out var expires) || expires < DateTimeOffset.UtcNow.ToUnixTimeSeconds()) throw new CryptographicException();
        return (identityId, securityVersion);
    }
    public bool Verify(string secret, string code) => TryVerify(secret, code, out _);
    public bool TryVerify(string secret, string code, out long matchedTimeStep)
    {
        matchedTimeStep = 0;
        var normalized = new string(code.Where(char.IsDigit).ToArray());
        if (normalized.Length != 6) return false;
        var counter = DateTimeOffset.UtcNow.ToUnixTimeSeconds() / 30;
        if (!CryptographicOperations.FixedTimeEquals(
                Encoding.ASCII.GetBytes(Code(secret, counter)),
                Encoding.ASCII.GetBytes(normalized))) return false;
        matchedTimeStep = counter;
        return true;
    }
    public IReadOnlyList<string> CreateRecoveryCodes() => Enumerable.Range(0, 8).Select(_ => Convert.ToHexString(RandomNumberGenerator.GetBytes(16)).ToLowerInvariant()).ToList();
    public string HashRecoveryCode(string code) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(NormalizeRecoveryCode(code))));
    public static string NormalizeRecoveryCode(string code) => new(code.Where(char.IsLetterOrDigit).Select(char.ToLowerInvariant).ToArray());
    public string ProvisioningUri(string productName, string instanceName, string username, string secret)
    {
        var issuer = $"{productName} · {instanceName}";
        return $"otpauth://totp/{Uri.EscapeDataString(issuer)}:{Uri.EscapeDataString(username)}?secret={secret}&issuer={Uri.EscapeDataString(issuer)}&algorithm=SHA1&digits=6&period=30";
    }

    private static string Code(string secret, long counter)
    {
        Span<byte> counterBytes = stackalloc byte[8]; BinaryPrimitives.WriteInt64BigEndian(counterBytes, counter);
        using var hmac = new HMACSHA1(DecodeBase32(secret)); var hash = hmac.ComputeHash(counterBytes.ToArray());
        var offset = hash[^1] & 0x0f; var binary = ((hash[offset] & 0x7f) << 24) | (hash[offset + 1] << 16) | (hash[offset + 2] << 8) | hash[offset + 3];
        return (binary % 1_000_000).ToString("D6");
    }
    private static string Base32(byte[] data)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; var output = new StringBuilder(); var buffer = 0; var bits = 0;
        foreach (var value in data) { buffer = (buffer << 8) | value; bits += 8; while (bits >= 5) { output.Append(alphabet[(buffer >> (bits - 5)) & 31]); bits -= 5; } }
        if (bits > 0) output.Append(alphabet[(buffer << (5 - bits)) & 31]); return output.ToString();
    }
    private static byte[] DecodeBase32(string input)
    {
        const string alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; var bytes = new List<byte>(); var buffer = 0; var bits = 0;
        foreach (var character in input.TrimEnd('=').ToUpperInvariant()) { var value = alphabet.IndexOf(character); if (value < 0) throw new FormatException(); buffer = (buffer << 5) | value; bits += 5; if (bits >= 8) { bytes.Add((byte)(buffer >> (bits - 8))); bits -= 8; } }
        return bytes.ToArray();
    }
}
