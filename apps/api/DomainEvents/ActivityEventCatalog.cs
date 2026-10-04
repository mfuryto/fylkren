using System.Text.Json;

namespace Fylkren.Api.DomainEvents;

public static class ActivityEventCatalog
{
    public static readonly string[] Types = ["task.created", "task.completed", "assignment.created", "assignment.dispatch_queued",
        "assignment.progress_received", "assignment.cancellation_queued", "report.received", "assignment.sent", "assignment.received", "assignment.accepted", "assignment.started", "assignment.updated",
        "assignment.completed", "assignment.cancelled", "assignment.reassigned", "assignment.reopened", "assignment.claimed", "assignment.released",
        "plan.published", "plan.updated", "plan.submitted", "execution.started", "execution.updated", "execution.submitted",
        "decision.created", "decision.updated", "risk.created", "risk.updated", "risk.closed", "measure.created", "measure.updated", "measure.completed",
        "site.created", "site.updated", "site.deactivated", "membership.deactivated",
        "comment.created", "learning.created", "learning.updated", "learning.comment_added",
        "report.updated", "report.submitted", "report.approved", "information.closed", "information.archived", "information.restored"];
    public static readonly string[] Resources = ["work_item", "task", "assignment", "plan", "execution", "decision", "risk", "measure", "report", "site", "person", "comment", "learning"];
    private static readonly HashSet<string> MetadataFields = ["status", "previousStatus", "changedFields", "revision", "phase", "resourceVersionId", "reasonCode", "workKind", "stepNumber", "stepName"];
    public static string ValidateMetadata(string eventType, string json)
    {
        if (!Types.Contains(eventType) || System.Text.Encoding.UTF8.GetByteCount(json) > 4096)
            throw new ArgumentException("Unknown activity type or oversized metadata.");
        using var document = JsonDocument.Parse(json, new JsonDocumentOptions { MaxDepth = 4 });
        if (document.RootElement.ValueKind != JsonValueKind.Object) throw new ArgumentException("Activity metadata must be an object.");
        var seen = new HashSet<string>();
        foreach (var field in document.RootElement.EnumerateObject())
        {
            if (!MetadataFields.Contains(field.Name) || !seen.Add(field.Name) || field.Value.ValueKind is JsonValueKind.Object or JsonValueKind.Array ||
                field.Value.ValueKind == JsonValueKind.String && (field.Value.GetString()!.Length > 200 || field.Value.GetString()!.Any(char.IsControl)))
                throw new ArgumentException("Only bounded activity metadata fields are allowed.");
        }
        if (document.RootElement.TryGetProperty("stepNumber", out var number) &&
            (eventType != "execution.updated" || number.ValueKind != JsonValueKind.Number || !number.TryGetInt32(out var index) || index < 1))
            throw new ArgumentException("Execution step numbers must be positive integers.");
        if (document.RootElement.TryGetProperty("stepName", out var name) &&
            (eventType != "execution.updated" || name.ValueKind != JsonValueKind.String))
            throw new ArgumentException("Execution step names must be bounded strings.");
        return json;
    }
}
