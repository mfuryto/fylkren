using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fylkren.Api.Federation;

// Only the receiver's official top-level answer may cross the instance
// boundary. Plans, subordinate activity and internal audit stay local.
internal sealed record FederationOfficialAnswerPayload(string OfficialReport,
    string? Classification, DateTimeOffset ApprovedAt);

internal static class FederationOfficialAnswerContract
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    internal static bool TryDecode(FederationWorkEnvelope envelope,
        out FederationOfficialAnswerPayload? payload)
    {
        payload = null;
        if (!FederationWorkProtocol.ValidEnvelope(envelope) ||
            envelope.MessageType != "assignment.answered" ||
            envelope.OriginInstanceId != envelope.RecipientInstanceId ||
            envelope.OriginSiteId != envelope.DestinationSiteId ||
            envelope.CounterpartWorkItemId is not Guid counterpart || counterpart == Guid.Empty)
            return false;
        try
        {
            payload = JsonSerializer.Deserialize<FederationOfficialAnswerPayload>(
                envelope.PayloadJson, JsonOptions);
            if (payload is null || string.IsNullOrWhiteSpace(payload.OfficialReport) ||
                payload.OfficialReport.Length > 20_000 ||
                payload.Classification is not null &&
                    (string.IsNullOrWhiteSpace(payload.Classification) || payload.Classification.Length > 20) ||
                payload.ApprovedAt == default ||
                payload.ApprovedAt.ToUnixTimeSeconds() > envelope.Timestamp + 300)
            {
                payload = null;
                return false;
            }
            return true;
        }
        catch (JsonException) { return false; }
    }
}
