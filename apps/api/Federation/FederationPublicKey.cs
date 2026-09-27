using System.Security.Cryptography;

namespace Fylkren.Api.Federation;

internal static class FederationPublicKey
{
    internal static bool TryParse(string? encoded, out byte[] der, out string fingerprint)
    {
        der = [];
        fingerprint = string.Empty;
        if (encoded is null || encoded.Length is < 80 or > 512) return false;
        try
        {
            der = Convert.FromBase64String(encoded);
            using var key = ECDsa.Create();
            key.ImportSubjectPublicKeyInfo(der, out var read);
            if (read != der.Length || key.KeySize != 256 ||
                key.ExportParameters(false).Curve.Oid.Value != "1.2.840.10045.3.1.7") return false;
            fingerprint = Convert.ToHexString(SHA256.HashData(der)).ToLowerInvariant();
            return true;
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            return false;
        }
    }
}
