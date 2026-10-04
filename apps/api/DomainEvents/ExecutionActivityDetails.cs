using System.Text.Json;

namespace Fylkren.Api.DomainEvents;

internal sealed record ExecutionActivityDetails(int? StepNumber, string? StepName)
{
    internal static ExecutionActivityDetails Read(string? metadata)
    {
        if (metadata is null) return new(null, null);
        using var value = JsonDocument.Parse(metadata);
        return new(value.RootElement.TryGetProperty("stepNumber", out var number) && number.TryGetInt32(out var index) ? index : null,
            value.RootElement.TryGetProperty("stepName", out var name) ? name.GetString() : null);
    }
}
