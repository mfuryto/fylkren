using System.Globalization;
using System.Security.Cryptography;
using System.Text;

namespace Fylkren.Api.Federation;

// V1 wire contract. Work and answer routes are registered only in
// FederationTest; ordinary installations have no operational federation
// producer, receiver or sender until the full workflow is ready.
internal sealed record FederationWorkEnvelope(int SchemaVersion, Guid MessageId, string MessageType,
    Guid SenderInstanceId, Guid RecipientInstanceId, Guid SourceSiteId, Guid DestinationSiteId,
    Guid OriginInstanceId, Guid OriginSiteId, Guid OriginResourceId, Guid? CounterpartWorkItemId,
    Guid? CorrelationId, Guid? CausationId, long Timestamp, Guid Nonce, string PayloadJson, string? Signature);

internal static class FederationWorkProtocol
{
    internal const int SchemaVersion = 1;
    internal const int MaxPayloadBytes = 256_000;

    internal static bool ValidEnvelope(FederationWorkEnvelope value) =>
        value.SchemaVersion == SchemaVersion && value.MessageId != Guid.Empty &&
        value.SenderInstanceId != Guid.Empty && value.RecipientInstanceId != Guid.Empty &&
        value.SenderInstanceId != value.RecipientInstanceId &&
        value.SourceSiteId != Guid.Empty && value.DestinationSiteId != Guid.Empty &&
        value.OriginInstanceId != Guid.Empty && value.OriginSiteId != Guid.Empty &&
        value.OriginResourceId != Guid.Empty && value.Nonce != Guid.Empty &&
        !string.IsNullOrWhiteSpace(value.MessageType) && value.MessageType.Length <= 80 &&
        value.MessageType.All(ch => ch is >= 'a' and <= 'z' or >= '0' and <= '9' or '.') &&
        value.PayloadJson is { Length: > 0 } &&
        Encoding.UTF8.GetByteCount(value.PayloadJson) <= MaxPayloadBytes;

    internal static byte[] SignedBytes(FederationWorkEnvelope value)
    {
        if (!ValidEnvelope(value)) throw new ArgumentException("Invalid federation work envelope.", nameof(value));
        var payloadHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value.PayloadJson)));
        return Encoding.ASCII.GetBytes(string.Join('\n',
            "fylkren-federation-work-envelope-v1",
            value.SchemaVersion.ToString(CultureInfo.InvariantCulture),
            value.MessageId.ToString("N"), value.MessageType,
            value.SenderInstanceId.ToString("N"), value.RecipientInstanceId.ToString("N"),
            value.SourceSiteId.ToString("N"), value.DestinationSiteId.ToString("N"),
            value.OriginInstanceId.ToString("N"), value.OriginSiteId.ToString("N"),
            value.OriginResourceId.ToString("N"), value.CounterpartWorkItemId?.ToString("N") ?? string.Empty,
            value.CorrelationId?.ToString("N") ?? string.Empty,
            value.CausationId?.ToString("N") ?? string.Empty,
            value.Timestamp.ToString(CultureInfo.InvariantCulture), value.Nonce.ToString("N"), payloadHash));
    }
}
