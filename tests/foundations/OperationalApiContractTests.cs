using System.Text.Json;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Decisions;
using Fylkren.Api.Platform;
using Fylkren.Api.Risks;

internal static class OperationalApiContractTests
{
    internal static void Run()
    {
        var machine = Guid.NewGuid();
        var site = Guid.NewGuid();
        var unit = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;
        var top = new ApiWorkGrant(Guid.NewGuid(), machine, site, null, now);
        var level = new ApiWorkGrant(Guid.NewGuid(), machine, site, unit, now);
        Require(top.OrganizationUnitId is null && level.OrganizationUnitId == unit &&
            top.MachineIdentityId == machine && top.SiteId == site,
            "Operational grant lost its exact Site/level boundary.");
        var decision = Decision.FromMachine(Guid.NewGuid(), site, machine, now);
        var decisionRevision = DecisionRevision.FromMachine(Guid.NewGuid(), decision.Id, 1, "Draft",
            "Synthetic decision", "Synthetic rationale", now, machine, now);
        var risk = Risk.FromMachine(Guid.NewGuid(), site, "task", Guid.NewGuid(), machine, now);
        var riskRevision = RiskRevision.FromMachine(Guid.NewGuid(), risk.Id, 1, "Risk", "Synthetic risk",
            2, 3, Guid.NewGuid(), "Synthetic owner", "active", null, 1, 2, machine, now);
        Require(decision.CreatedByMachineId == machine && decision.CreatedByPersonId is null &&
            decisionRevision.RecordedByMachineId == machine && decisionRevision.RecordedByPersonId is null &&
            decisionRevision.Status == "draft" && risk.CreatedByMachineId == machine &&
            riskRevision.RecordedByMachineId == machine && riskRevision.Score == 6 && riskRevision.ResidualScore == 2,
            "Machine domain authorship or risk scoring was lost.");

        using var json = JsonDocument.Parse(JsonSerializer.Serialize(ApiDescriptionEndpoints.Document()));
        var root = json.RootElement;
        Require(root.GetProperty("openapi").GetString() == "3.1.0", "OpenAPI version changed.");
        var paths = root.GetProperty("paths");
        foreach (var path in new[]
        {
            "/api/v1/work/catalog", "/api/v1/work/items", "/api/v1/work/items/{itemId}",
            "/api/v1/work/items/{itemId}/planning", "/api/v1/work/items/{itemId}/execution",
            "/api/v1/work/items/{itemId}/decisions", "/api/v1/work/items/{itemId}/risks",
            "/api/v1/work/items/{itemId}/activity", "/api/v1/work/items/{itemId}/comments",
            "/api/v1/work/items/{itemId}/transitions"
        }) Require(paths.TryGetProperty(path, out _), $"OpenAPI omitted {path}.");
        foreach (var path in new[]
        {
            "/api/v1/work/items/{itemId}/decisions/{decisionId}",
            "/api/v1/work/items/{itemId}/risks/{riskId}",
            "/api/v1/work/items/{itemId}/risks/{riskId}/measures",
            "/api/v1/work/items/{itemId}/risks/{riskId}/measures/{measureId}",
            "/api/v1/work/items/{itemId}/planning/steps/{stepId}",
            "/api/v1/work/items/{itemId}/execution/steps/{stepId}"
        }) Require(paths.TryGetProperty(path, out _), $"OpenAPI omitted command path {path}.");
        Require(paths.GetProperty("/api/v1/work/items/{itemId}/decisions").TryGetProperty("post", out _),
            "OpenAPI omitted decision draft creation.");
        Require(paths.GetProperty("/api/v1/work/items/{itemId}/risks").TryGetProperty("post", out _),
            "OpenAPI omitted risk creation.");
        foreach (var path in new[]
        {
            "/api/v1/work/items/{itemId}/decisions/{decisionId}",
            "/api/v1/work/items/{itemId}/risks/{riskId}",
            "/api/v1/work/items/{itemId}/risks/{riskId}/measures/{measureId}"
        }) Require(paths.GetProperty(path).GetProperty("put").GetProperty("parameters").EnumerateArray()
            .Any(parameter => parameter.GetProperty("name").GetString() == "Idempotency-Key"),
            $"Revision command lacks idempotency in {path}.");
        Require(paths.GetProperty("/api/v1/work/items").TryGetProperty("post", out _),
            "OpenAPI omitted work-item creation.");
        Require(paths.GetProperty("/api/v1/work/items/{itemId}").TryGetProperty("put", out _),
            "OpenAPI omitted versioned work-item updates.");
        foreach (var eventType in new[] { "assignment.accepted", "assignment.updated", "comment.created" })
            Require(DomainEventTypes.ExternallySupported.Contains(eventType),
                $"Webhook catalogue omitted {eventType}.");
        Require(root.GetProperty("components").GetProperty("securitySchemes")
            .TryGetProperty("FylkrenSignature", out _), "Signed-v2 authentication is absent from OpenAPI.");

        Console.WriteLine("Operational API contract tests passed.");
    }

    private static void Require(bool condition, string message)
    {
        if (!condition) throw new Exception(message);
    }
}
