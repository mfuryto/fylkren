namespace Fylkren.Api.Platform;

public static class ApiDescriptionEndpoints
{
    public static IEndpointRouteBuilder MapApiDescriptionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/v1/openapi.json", () => Results.Json(Document()))
            .RequireAuthorization("MachineApi").RequireRateLimiting("administration-api");
        return endpoints;
    }

    internal static object Document()
    {
        var paths = new Dictionary<string, object>
        {
            ["/api/v1/openapi.json"] = Path(Get("Read this API contract", null)),
            ["/api/v1/administration/sites"] = Path(
                Get("List Sites", "sites:read"), Post("Create a Site", "sites:write", "CreateSite")),
            ["/api/v1/administration/sites/{siteId}"] = Path(
                Get("Read a Site", "sites:read", "siteId"), Put("Update a Site", "sites:write", "UpdateSite", "siteId", true)),
            ["/api/v1/administration/site-placement-options"] = Path(Get("List Site placement options", "sites:read")),
            ["/api/v1/administration/sites/{siteId}/move"] = Path(Post("Move a Site", "sites:move", "MoveSite", "siteId")),
            ["/api/v1/administration/sites/{siteId}/deactivate"] = Path(Post("Deactivate a Site", "sites:deactivate", null, "siteId", true)),
            ["/api/v1/administration/users"] = Path(Get("List users", "users:read")),
            ["/api/v1/administration/users/{personId}"] = Path(Get("Read a user", "users:read", "personId")),
            ["/api/v1/administration/users/{personId}/assign"] = Path(Post("Assign a user", "users:assign", "AssignUser", "personId")),
            ["/api/v1/administration/users/{personId}/move"] = Path(Post("Move a user", "users:move", "MoveUser", "personId")),
            ["/api/v1/administration/users/{personId}/deactivate"] = Path(Post("Deactivate a user", "users:deactivate", null, "personId")),
            ["/api/v1/administration/classifications"] = Path(
                Get("List classifications", "classifications:read"), Post("Create a classification", "classifications:write", "Classification")),
            ["/api/v1/administration/classifications/settings"] = Path(Put("Update classification settings", "classifications:write", "ClassificationSettings", null, true)),
            ["/api/v1/administration/classifications/{id}"] = Path(
                Put("Update a classification", "classifications:write", "Classification", "id", true),
                Delete("Deactivate a classification", "classifications:write", "id", true)),
            ["/api/v1/reports"] = Path(Get("List approved final reports", "reports:read plus an exact report grant")),
            ["/api/v1/reports/{reportId}"] = Path(Get("Read an approved final report", "reports:read plus an exact report grant", "reportId")),
            ["/api/v1/work/catalog"] = Path(Get("Read work reference data", "work:read plus an exact work grant")),
            ["/api/v1/work/items"] = Path(
                Get("List work items at one exact level", "work:read plus an exact work grant"),
                Post("Create a work item", "work:write plus an exact work grant", "CreateWorkItem")),
            ["/api/v1/work/items/{itemId}"] = Path(
                Get("Read a work item", "work:read plus an exact work grant", "itemId"),
                Put("Update work-item content", "work:write plus an exact work grant", "UpdateWorkItem", "itemId", true)),
            ["/api/v1/work/items/{itemId}/comments"] = Path(
                Get("List work-item comments", "work:read plus an exact work grant", "itemId"),
                Post("Add a work-item comment", "work:write plus an exact work grant", "AddComment", "itemId")),
            ["/api/v1/work/items/{itemId}/transitions"] = Path(
                Post("Perform a guarded non-approval transition", "work:transition plus an exact work grant", "TransitionWorkItem", "itemId", true)),
            ["/api/v1/work/items/{itemId}/planning"] = Path(Get("Read planning", "work:read plus an exact work grant", "itemId")),
            ["/api/v1/work/items/{itemId}/execution"] = Path(Get("Read execution", "work:read plus an exact work grant", "itemId")),
            ["/api/v1/work/items/{itemId}/decisions"] = Path(Get("Read decisions", "work:read plus an exact work grant", "itemId")),
            ["/api/v1/work/items/{itemId}/risks"] = Path(Get("Read risks and measures", "work:read plus an exact work grant", "itemId")),
            ["/api/v1/work/items/{itemId}/activity"] = Path(Get("Read object activity", "activity:read plus an exact work grant", "itemId"))
        };
        return new
        {
            openapi = "3.1.0",
            info = new { title = "Fylkren API", version = "1.0.0", description = "Stable versioned machine integration API." },
            servers = new[] { new { url = "/" } },
            security = new[] { new Dictionary<string, string[]> { ["FylkrenSignature"] = [] } },
            paths,
            components = new
            {
                securitySchemes = new Dictionary<string, object>
                {
                    ["FylkrenSignature"] = new { type = "apiKey", @in = "header", name = "Authorization",
                        description = "Fylkren-Signature signed-v2 request with timestamp, nonce, content hash and ECDSA signature headers." }
                },
                schemas = Schemas()
            }
        };
    }

    private static Dictionary<string, object> Schemas() => new()
    {
        ["CreateSite"] = ObjectSchema(new Dictionary<string, object>
        { ["name"] = Text(200), ["overviewDesign"] = Enum("classic", "compact") }, "name", "overviewDesign"),
        ["UpdateSite"] = ObjectSchema(new Dictionary<string, object>
        { ["name"] = Text(200), ["overviewDesign"] = Enum("classic", "compact") }, "name", "overviewDesign"),
        ["MoveSite"] = ObjectSchema(new Dictionary<string, object>
        { ["parentOrganizationUnitId"] = NullableUuid() }),
        ["AssignUser"] = ObjectSchema(new Dictionary<string, object> { ["siteId"] = Uuid() }, "siteId"),
        ["MoveUser"] = ObjectSchema(new Dictionary<string, object>
        { ["sourceSiteId"] = Uuid(), ["targetSiteId"] = Uuid() }, "sourceSiteId", "targetSiteId"),
        ["Classification"] = ObjectSchema(new Dictionary<string, object>
        { ["name"] = Text(100), ["abbreviation"] = Text(12), ["sortOrder"] = new { type = "integer" }, ["isActive"] = new { type = "boolean" } },
            "name", "abbreviation", "sortOrder"),
        ["ClassificationSettings"] = ObjectSchema(new Dictionary<string, object>
        { ["enabled"] = new { type = "boolean" } }, "enabled"),
        ["CreateWorkItem"] = ObjectSchema(new Dictionary<string, object>
        {
            ["siteId"] = Uuid(), ["organizationUnitId"] = NullableUuid(), ["workItemTypeId"] = NullableUuid(),
            ["sourceTypeId"] = NullableUuid(), ["senderId"] = NullableUuid(), ["title"] = Text(200),
            ["description"] = Text(10_000), ["recommendation"] = Text(4_000), ["referenceUrl"] = Text(2_048),
            ["priority"] = Enum("low", "normal", "high", "critical"), ["dueAt"] = DateTime()
        }, "siteId", "title", "description", "priority"),
        ["UpdateWorkItem"] = ObjectSchema(new Dictionary<string, object>
        {
            ["title"] = Text(200), ["description"] = Text(10_000), ["recommendation"] = Text(4_000),
            ["referenceUrl"] = Text(2_048), ["priority"] = Enum("low", "normal", "high", "critical"), ["dueAt"] = DateTime()
        }, "title", "description", "priority"),
        ["AddComment"] = ObjectSchema(new Dictionary<string, object> { ["text"] = Text(10_000) }, "text"),
        ["TransitionWorkItem"] = ObjectSchema(new Dictionary<string, object>
        {
            ["status"] = Enum("under_review", "on_hold", "rejected"), ["decisionNote"] = Text(2_000),
            ["priority"] = Enum("low", "normal", "high", "critical")
        }, "status"),
        ["Problem"] = ObjectSchema(new Dictionary<string, object>
        {
            ["type"] = Text(), ["title"] = Text(), ["status"] = new { type = "integer" }, ["detail"] = Text(), ["code"] = Text()
        })
    };

    private static Dictionary<string, object> Path(params KeyValuePair<string, object>[] operations) =>
        operations.ToDictionary(x => x.Key, x => x.Value);
    private static KeyValuePair<string, object> Get(string summary, string? authorization, string? id = null) =>
        new("get", Operation(summary, authorization, id, null, false, false));
    private static KeyValuePair<string, object> Post(string summary, string authorization, string? schema,
        string? id = null, bool version = false) => new("post", Operation(summary, authorization, id, schema, true, version));
    private static KeyValuePair<string, object> Put(string summary, string authorization, string schema,
        string? id = null, bool version = false) => new("put", Operation(summary, authorization, id, schema, false, version));
    private static KeyValuePair<string, object> Delete(string summary, string authorization, string id,
        bool version) => new("delete", Operation(summary, authorization, id, null, false, version));

    private static object Operation(string summary, string? authorization, string? id, string? schema,
        bool idempotency, bool version)
    {
        var parameters = new List<object>();
        if (id is not null) parameters.Add(new { name = id, @in = "path", required = true, schema = Uuid() });
        if (idempotency) parameters.Add(new { name = "Idempotency-Key", @in = "header", required = true,
            schema = new { type = "string", minLength = 8, maxLength = 128 } });
        if (version) parameters.Add(new { name = "If-Match", @in = "header", required = true,
            schema = new { type = "string" }, description = "ETag from the latest resource read." });
        return new Dictionary<string, object?>
        {
            ["summary"] = summary, ["description"] = authorization, ["parameters"] = parameters,
            ["requestBody"] = schema is null ? null : new { required = true, content = new Dictionary<string, object>
            { ["application/json"] = new { schema = new Dictionary<string, string> { ["$ref"] = $"#/components/schemas/{schema}" } } } },
            ["responses"] = Responses()
        }.Where(x => x.Value is not null).ToDictionary(x => x.Key, x => x.Value!);
    }

    private static Dictionary<string, object> Responses() => new()
    {
        ["200"] = new { description = "Success" }, ["201"] = new { description = "Created" },
        ["400"] = Error("Invalid request"), ["401"] = Error("Invalid machine authentication"),
        ["403"] = Error("Missing scope, entitlement, or grant"), ["404"] = Error("Not found or not visible"),
        ["409"] = Error("State, version, or idempotency conflict"), ["428"] = Error("If-Match is required"),
        ["429"] = Error("Rate limit exceeded")
    };
    private static object Error(string description) => new { description, content = new Dictionary<string, object>
    { ["application/problem+json"] = new { schema = new Dictionary<string, string> { ["$ref"] = "#/components/schemas/Problem" } } } };
    private static object ObjectSchema(Dictionary<string, object> properties, params string[] required) =>
        new { type = "object", additionalProperties = false, properties, required };
    private static object Uuid() => new { type = "string", format = "uuid" };
    private static object NullableUuid() => new { type = new[] { "string", "null" }, format = "uuid" };
    private static object Text(int? maxLength = null) => maxLength is null ? new { type = "string" } : (object)new { type = "string", maxLength };
    private static object DateTime() => new { type = new[] { "string", "null" }, format = "date-time" };
    private static object Enum(params string[] values) => new { type = "string", @enum = values };
}
