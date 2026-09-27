using System.Globalization;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationGrantCheckRequest(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, long Timestamp, Guid Nonce, Guid SourceSiteId,
    Guid DestinationSiteId, string? Signature);

internal sealed record FederationGrantCheckResponse(int SchemaVersion, Guid SenderInstanceId,
    Guid RecipientInstanceId, long Timestamp, Guid Nonce, Guid SourceSiteId,
    Guid DestinationSiteId, bool Allowed, long? GrantRevision, string Signature);

internal static class FederationGrantCheckProtocol
{
    internal const int SchemaVersion = 1;

    internal static byte[] RequestBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        Guid sourceSite, Guid destinationSite) => Canonical("fylkren-federation-grant-check-request-v1",
            sender, recipient, timestamp, nonce, sourceSite, destinationSite);

    internal static byte[] ResponseBytes(Guid sender, Guid recipient, long timestamp, Guid nonce,
        Guid sourceSite, Guid destinationSite, bool allowed, long? revision) =>
        Encoding.ASCII.GetBytes(string.Join('\n',
            "fylkren-federation-grant-check-response-v1", sender.ToString("N"), recipient.ToString("N"),
            timestamp.ToString(CultureInfo.InvariantCulture), nonce.ToString("N"),
            sourceSite.ToString("N"), destinationSite.ToString("N"), allowed ? "1" : "0",
            revision?.ToString(CultureInfo.InvariantCulture) ?? string.Empty));

    internal static bool ValidDecision(bool allowed, long? revision) =>
        allowed ? revision > 0 : revision is null;

    private static byte[] Canonical(string purpose, Guid sender, Guid recipient, long timestamp,
        Guid nonce, Guid sourceSite, Guid destinationSite) => Encoding.ASCII.GetBytes(string.Join('\n',
            purpose, sender.ToString("N"), recipient.ToString("N"), timestamp.ToString(CultureInfo.InvariantCulture),
            nonce.ToString("N"), sourceSite.ToString("N"), destinationSite.ToString("N")));
}
