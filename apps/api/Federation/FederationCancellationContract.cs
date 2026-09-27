using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fylkren.Api.Federation;

internal sealed record FederationCancellationPayload(string Reason);

internal static class FederationCancellationContract
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    internal static bool TryDecode(FederationWorkEnvelope envelope,
        out FederationCancellationPayload? payload)
    {
        payload = null;
        if (!FederationWorkProtocol.ValidEnvelope(envelope) ||
            envelope.MessageType != "assignment.cancelled" ||
            envelope.OriginInstanceId != envelope.SenderInstanceId ||
            envelope.OriginSiteId != envelope.SourceSiteId ||
            envelope.CounterpartWorkItemId is not Guid counterpart || counterpart == Guid.Empty)
            return false;
        try
        {
            payload = JsonSerializer.Deserialize<FederationCancellationPayload>(envelope.PayloadJson, JsonOptions);
            if (payload?.Reason is null || payload.Reason.Trim().Length is < 2 or > 2000)
            {
                payload = null;
                return false;
            }
            return true;
        }
        catch (JsonException) { return false; }
    }
}
