using System.Text.Json;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Platform;

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
