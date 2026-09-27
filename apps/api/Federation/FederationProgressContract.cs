using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fylkren.Api.Federation;

// Deliberately coarse: no internal units, people, plans or execution details.
internal sealed record FederationProgressPayload(string Phase, long Sequence);

internal static class FederationProgressContract
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    internal static bool TryDecode(FederationWorkEnvelope envelope,
        out FederationProgressPayload? payload)
    {
        payload = null;
        if (!FederationWorkProtocol.ValidEnvelope(envelope) ||
            envelope.MessageType != "assignment.progress" ||
            envelope.OriginInstanceId != envelope.RecipientInstanceId ||
            envelope.OriginSiteId != envelope.DestinationSiteId ||
            envelope.CounterpartWorkItemId is not Guid counterpart || counterpart == Guid.Empty)
            return false;
        try
        {
            payload = JsonSerializer.Deserialize<FederationProgressPayload>(envelope.PayloadJson, JsonOptions);
            if (payload is null || payload.Phase is not
                ("under_review" or "assigned" or "in_progress") || payload.Sequence < 1)
            {
                payload = null;
                return false;
            }
            return true;
        }
        catch (JsonException) { return false; }
    }
}
