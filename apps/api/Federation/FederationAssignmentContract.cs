using System.Text.Json;
using System.Text.Json.Serialization;

namespace Fylkren.Api.Federation;

// Data allowed to cross the server boundary for an initial assignment. The
// sender's local users, units, lookup IDs, plans and internal history do not.
internal sealed record FederationAssignmentPayload(string Kind, string Title, string Instruction,
    string Priority, DateTimeOffset? DueAt, string? RequestBasis,
    string? SourceTypeName, string? SenderName);

internal static class FederationAssignmentContract
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
    };

    internal static bool TryDecode(FederationWorkEnvelope envelope, out FederationAssignmentPayload? payload)
    {
        payload = null;
        if (!FederationWorkProtocol.ValidEnvelope(envelope) ||
            envelope.MessageType != "assignment.created" ||
            envelope.OriginInstanceId != envelope.SenderInstanceId ||
            envelope.OriginSiteId != envelope.SourceSiteId ||
            envelope.CounterpartWorkItemId is not null)
            return false;
        try
        {
            payload = JsonSerializer.Deserialize<FederationAssignmentPayload>(envelope.PayloadJson, JsonOptions);
            if (payload is null || payload.Kind is not ("request" or "assignment") ||
                string.IsNullOrWhiteSpace(payload.Title) || payload.Title.Length is < 2 or > 200 ||
                string.IsNullOrWhiteSpace(payload.Instruction) || payload.Instruction.Length > 10_000 ||
                payload.Priority is not ("low" or "normal" or "high" or "critical") ||
                payload.RequestBasis is { Length: > 100_000 } ||
                payload.SourceTypeName is { Length: > 200 } ||
                payload.SenderName is { Length: > 200 })
            {
                payload = null;
                return false;
            }
            return true;
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
