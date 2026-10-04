using System.Globalization;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationCapabilityRequest(Guid SenderInstanceId,
    Guid RecipientInstanceId, int MinimumProtocolVersion, int MaximumProtocolVersion,
    int[] WorkSchemaVersions, string[] WorkMessageTypes, long Timestamp, Guid Nonce,
    string? Signature);

internal sealed record FederationCapabilityResponse(Guid SenderInstanceId,
    Guid RecipientInstanceId, int ProtocolVersion, int WorkSchemaVersion,
    string[] WorkMessageTypes, long Timestamp, Guid Nonce, string Signature);

internal static class FederationCapabilityProtocol
{
    internal const int ProtocolVersion = 1;
    internal static readonly int[] WorkSchemaVersions = [FederationWorkProtocol.SchemaVersion];
    internal static readonly string[] WorkMessageTypes =
    [
        "assignment.answered",
        "assignment.cancelled",
        "assignment.created",
        "assignment.progress"
    ];

    internal static byte[] RequestBytes(FederationCapabilityRequest value) => Canonical(
        "fylkren-federation-capability-request-v1", value.SenderInstanceId,
        value.RecipientInstanceId, value.MinimumProtocolVersion,
        value.MaximumProtocolVersion, value.WorkSchemaVersions,
        value.WorkMessageTypes, value.Timestamp, value.Nonce);

    internal static byte[] ResponseBytes(FederationCapabilityResponse value) => Canonical(
        "fylkren-federation-capability-response-v1", value.SenderInstanceId,
        value.RecipientInstanceId, value.ProtocolVersion, value.ProtocolVersion,
        [value.WorkSchemaVersion], value.WorkMessageTypes, value.Timestamp, value.Nonce);

    internal static bool ValidOffer(FederationCapabilityRequest value) =>
        value.MinimumProtocolVersion >= 1 &&
        value.MaximumProtocolVersion >= value.MinimumProtocolVersion &&
        ValidSchemas(value.WorkSchemaVersions) && ValidTypes(value.WorkMessageTypes);

    internal static bool ValidSelection(FederationCapabilityResponse value,
        FederationCapabilityRequest offer) => value.ProtocolVersion >= offer.MinimumProtocolVersion &&
        value.ProtocolVersion <= offer.MaximumProtocolVersion &&
        offer.WorkSchemaVersions.Contains(value.WorkSchemaVersion) &&
        ValidTypes(value.WorkMessageTypes) &&
        value.WorkMessageTypes.All(offer.WorkMessageTypes.Contains);

    private static bool ValidSchemas(int[]? values) => values is { Length: > 0 and <= 16 } &&
        values.All(value => value >= 1) && values.SequenceEqual(values.Distinct().Order());

    private static bool ValidTypes(string[]? values) => values is { Length: > 0 and <= 32 } &&
        values.All(value => value is not null && value.Length is > 0 and <= 80 &&
            value.All(character => char.IsAsciiLetterOrDigit(character) || character is '.' or '-' or '_')) &&
        values.SequenceEqual(values.Distinct(StringComparer.Ordinal).Order(StringComparer.Ordinal));

    private static byte[] Canonical(string purpose, Guid sender, Guid recipient,
        int minimumProtocol, int maximumProtocol, int[] schemas, string[] messageTypes,
        long timestamp, Guid nonce) => Encoding.ASCII.GetBytes(string.Join('\n', purpose,
            sender.ToString("N"), recipient.ToString("N"),
            minimumProtocol.ToString(CultureInfo.InvariantCulture),
            maximumProtocol.ToString(CultureInfo.InvariantCulture),
            string.Join(',', schemas.Select(value => value.ToString(CultureInfo.InvariantCulture))),
            string.Join(',', messageTypes), timestamp.ToString(CultureInfo.InvariantCulture),
            nonce.ToString("N")));
}
