using System.Globalization;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationGrantCheckRequest(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, long Timestamp, Guid Nonce, Guid SourceSiteId,
    Guid DestinationSiteId, string? Signature, string? SignatureAlgorithm = null);

internal sealed record FederationGrantCheckResponse(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, long Timestamp, Guid Nonce, Guid SourceSiteId,
    Guid DestinationSiteId, bool Allowed, long? GrantRevision, string Signature,
    string? SignatureAlgorithm = null);

internal static class FederationGrantCheckProtocol
{
    internal const int SchemaVersion = 1;

    internal static byte[] RequestBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        Guid sourceSite, Guid destinationSite, string? signatureAlgorithm = null) => Canonical(
            "fylkren-federation-grant-check-request-v1", sender, recipient, timestamp, nonce,
            sourceSite, destinationSite, signatureAlgorithm);

    internal static byte[] ResponseBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        Guid sourceSite, Guid destinationSite, bool allowed, long? revision,
        string? signatureAlgorithm = null) => Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose("fylkren-federation-grant-check-response-v1", signatureAlgorithm),
            sender.ToString("N"), recipient.ToString("N"),
            timestamp.ToString(CultureInfo.InvariantCulture), nonce.ToString("N"),
            sourceSite.ToString("N"), destinationSite.ToString("N"), allowed ? "1" : "0",
            revision?.ToString(CultureInfo.InvariantCulture) ?? string.Empty
        }.Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));

    internal static bool ValidDecision(bool allowed, long? revision) =>
        allowed ? revision > 0 : revision is null;

    private static byte[] Canonical(string purpose, Guid sender, Guid recipient, long timestamp,
        Guid nonce, Guid sourceSite, Guid destinationSite, string? signatureAlgorithm) =>
        Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose(purpose, signatureAlgorithm), sender.ToString("N"),
            recipient.ToString("N"), timestamp.ToString(CultureInfo.InvariantCulture), nonce.ToString("N"),
            sourceSite.ToString("N"), destinationSite.ToString("N")
        }.Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));
}
