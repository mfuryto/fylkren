using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationKeyRotationStageRequest(Guid SenderInstanceId,
    Guid RecipientInstanceId, Guid RotationId, long Timestamp, Guid Nonce,
    string CurrentPublicKeySpki, string NewPublicKeySpki,
    string CurrentSignature, string NewSignature, string? SignatureAlgorithm = null);

internal sealed record FederationKeyRotationCompleteRequest(Guid SenderInstanceId,
    Guid RecipientInstanceId, Guid RotationId, long Timestamp, Guid Nonce, string Signature,
    string? SignatureAlgorithm = null);

internal sealed record FederationKeyRotationReceipt(Guid SenderInstanceId,
    Guid RecipientInstanceId, Guid RotationId, string Phase, long Timestamp,
    Guid Nonce, string Signature, string? SignatureAlgorithm = null);

internal static class FederationKeyRotationProtocol
{
    internal static byte[] StageBytes(Guid sender, Guid recipient, Guid rotationId,
        long timestamp, Guid nonce, string currentFingerprint, string newFingerprint,
        string? signatureAlgorithm = null) => Canonical(
            "fylkren-federation-key-rotation-stage-v1", sender, recipient,
            rotationId, timestamp, nonce, signatureAlgorithm, currentFingerprint, newFingerprint);

    internal static byte[] CompleteBytes(Guid sender, Guid recipient, Guid rotationId,
        long timestamp, Guid nonce, string? signatureAlgorithm = null) => Canonical(
            "fylkren-federation-key-rotation-complete-v1", sender, recipient,
            rotationId, timestamp, nonce, signatureAlgorithm);

    internal static byte[] ReceiptBytes(Guid sender, Guid recipient, Guid rotationId,
        string phase, long timestamp, Guid nonce, string? signatureAlgorithm = null) => Canonical(
            "fylkren-federation-key-rotation-receipt-v1", sender, recipient,
            rotationId, timestamp, nonce, signatureAlgorithm, phase);

    internal static bool Verify(byte[] publicKey, byte[] canonical, string? signature) =>
        FederationProbeProtocol.Verify(publicKey, canonical, signature);

    internal static string Sign(ECDsa key, byte[] canonical) =>
        FederationProbeProtocol.Sign(key, canonical);

    private static byte[] Canonical(string purpose, Guid sender, Guid recipient,
        Guid rotationId, long timestamp, Guid nonce, string? signatureAlgorithm,
        params string[] values) => Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose(purpose, signatureAlgorithm), sender.ToString("N"),
            recipient.ToString("N"), rotationId.ToString("N"),
            timestamp.ToString(CultureInfo.InvariantCulture), nonce.ToString("N")
        }.Concat(values).Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));
}
