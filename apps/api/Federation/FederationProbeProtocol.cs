using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Fylkren.Api.Federation;

internal static class FederationProbeProtocol
{
    internal static byte[] RequestBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        string? signatureAlgorithm = null) => Canonical("fylkren-federation-probe-request-v1",
            sender, recipient, timestamp, nonce, signatureAlgorithm);

    internal static byte[] ResponseBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        string? signatureAlgorithm = null) => Canonical("fylkren-federation-probe-response-v1",
            sender, recipient, timestamp, nonce, signatureAlgorithm);

    internal static string Sign(ECDsa key, byte[] data) => Convert.ToBase64String(key.SignData(
        data, HashAlgorithmName.SHA256, DSASignatureFormat.IeeeP1363FixedFieldConcatenation));

    internal static bool Verify(byte[] publicKey, byte[] data, string? encodedSignature)
    {
        if (encodedSignature is null || encodedSignature.Length > 128) return false;
        try
        {
            var signature = Convert.FromBase64String(encodedSignature);
            if (signature.Length != 64) return false;
            using var key = ECDsa.Create();
            key.ImportSubjectPublicKeyInfo(publicKey, out _);
            return key.VerifyData(data, signature, HashAlgorithmName.SHA256,
                DSASignatureFormat.IeeeP1363FixedFieldConcatenation);
        }
        catch (Exception ex) when (ex is FormatException or CryptographicException)
        {
            return false;
        }
    }

    private static byte[] Canonical(string purpose, Guid sender, Guid recipient, long timestamp,
        Guid nonce, string? signatureAlgorithm) => Encoding.ASCII.GetBytes(string.Join('\n',
            new[] { FederationSignatureProtocol.Purpose(purpose, signatureAlgorithm), sender.ToString("N"),
                recipient.ToString("N"), timestamp.ToString(CultureInfo.InvariantCulture),
                nonce.ToString("N") }.Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));
}
