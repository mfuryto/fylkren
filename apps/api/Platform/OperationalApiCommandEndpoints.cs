using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Persistence;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal static class OperationalApiCommandEndpoints
{
    private static readonly HashSet<string> Priorities = ["low", "normal", "high", "critical"];
    private static readonly HashSet<string> TerminalStatuses = ["completed", "cancelled", "rejected", "reassigned"];

    internal static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/items", CreateItem).RequireScope("work:write");
        api.MapPut("/items/{itemId:guid}", UpdateItem).RequireScope("work:write");
        api.MapPost("/items/{itemId:guid}/comments", AddComment).RequireScope("work:write");
        api.MapPost("/items/{itemId:guid}/transitions", Transition).RequireScope("work:transition");
    }

    private static RouteHandlerBuilder RequireScope(this RouteHandlerBuilder route, string scope) =>
        route.RequireAuthorization(policy => policy.RequireClaim("scope", scope))
            .RequireRateLimiting("administration-api");

    private sealed record CreateWorkItemRequest(Guid SiteId, Guid? OrganizationUnitId, Guid? WorkItemTypeId,
        Guid? SourceTypeId, Guid? SenderId, string? Title, string? Description, string? Recommendation,
        string? ReferenceUrl, string? Priority, DateTimeOffset? DueAt);

    private sealed record UpdateWorkItemRequest(string? Title, string? Description, string? Recommendation,
        string? ReferenceUrl, string? Priority, DateTimeOffset? DueAt);

    private sealed record CommentRequest(string? Text);
    private sealed record TransitionRequest(string? Status, string? DecisionNote, string? Priority);

    private static async Task<IResult> CreateItem(CreateWorkItemRequest request, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!OperationalApiEndpoints.MachineId(context.User, out var machineId)) return Results.Unauthorized();
        if (!await OperationalApiEndpoints.HasGrant(machineId, request.SiteId, request.OrganizationUnitId, db, ct))
            return Forbidden("The API client has no grant for this exact work level.");
        if (ValidateContent(request.Title, request.Description, request.Recommendation,
                request.ReferenceUrl, request.Priority) is { } invalid) return invalid;
        if (!await ActiveLevel(request.SiteId, request.OrganizationUnitId, db, ct))
            return Validation("organizationUnitId", "Select an active work level in the Site.");

        WorkItemType? type = null;
        if (request.WorkItemTypeId is Guid typeId)
        {
            type = await db.WorkItemTypes.SingleOrDefaultAsync(x => x.Id == typeId &&
                x.SiteId == request.SiteId && x.IsActive, ct);
            if (type is null) return Validation("workItemTypeId", "Select an active task type in the Site.");
            if (type.IsSystemManaged) return Validation("workItemTypeId",
                "Request tasks must be sent through the human or federation workflow.");
        }
        if (!await ValidLookup(request.SiteId, request.SourceTypeId, "source-type", db, ct) ||
            !await ValidLookup(request.SiteId, request.SenderId, "sender", db, ct))
            return Validation("lookup", "Select active source and sender values in the Site.");

        var hash = Hash("work-item.create", request);
        if (await Replay(machineId, hash, context, db, ct) is { } replay) return replay;
        var now = DateTimeOffset.UtcNow;
        var item = new WorkItem(Guid.NewGuid(), request.SiteId, null, request.Title!.Trim(),
            request.Description!.Trim(), Normalize(request.ReferenceUrl), request.Priority!, request.DueAt, now,
            workItemTypeId: request.WorkItemTypeId, sourceTypeId: request.SourceTypeId, senderId: request.SenderId,
            recommendation: Normalize(request.Recommendation), createdByMachineId: machineId);
        if (request.OrganizationUnitId is Guid unitId) item.RegisterAtUnit(unitId, now);
        db.WorkItems.Add(item);
        AddIdempotency(db, machineId, context, hash, item.Id, now);
        await OperationalApiActivity.Record(db, machineId, item.SiteId, "task.created", "task",
            item.Id, item.Id, new { status = item.Status }, context, now, "task.created", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException exception) when (IsIdempotencyConflict(exception))
        {
            db.ChangeTracker.Clear();
            return await Replay(machineId, hash, context, db, ct) ??
                Problem(context, 409, "idempotency_conflict", "The request was processed concurrently. Retry with the same key.");
        }
        var version = db.Entry(item).Property<uint>("xmin").CurrentValue;
        context.Response.Headers.Location = $"/api/v1/work/items/{item.Id}";
        context.Response.Headers.ETag = ETag(version);
        return Results.Json(new { item.Id, item.ReferenceCode, version }, statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> UpdateItem(Guid itemId, UpdateWorkItemRequest request,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await WritableItem(itemId, context, db, ct);
        if (access.Error is not null) return access.Error;
        if (ValidateContent(request.Title, request.Description, request.Recommendation,
                request.ReferenceUrl, request.Priority) is { } invalid) return invalid;
        var item = access.Item!;
        if (TerminalStatuses.Contains(item.Status))
            return Conflict("Closed work cannot be edited through the operational API.");
        item.UpdateOperationalContent(request.Title!, request.Description!, request.Recommendation,
            Normalize(request.ReferenceUrl), request.Priority!, request.DueAt, DateTimeOffset.UtcNow);
        await OperationalApiActivity.Record(db, access.MachineId, item.SiteId, "assignment.updated", "task",
            item.Id, item.Id, new { changedFields = "title,description,recommendation,referenceUrl,priority,dueAt", status = item.Status },
            context, DateTimeOffset.UtcNow, "assignment.updated", ct);
        return await SaveVersioned(item, context, db, ct);
    }

    private static async Task<IResult> AddComment(Guid itemId, CommentRequest request,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!OperationalApiEndpoints.MachineId(context.User, out var machineId)) return Results.Unauthorized();
        var item = await db.WorkItems.AsNoTracking().SingleOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null || !await OperationalApiEndpoints.HasGrant(machineId, item.SiteId, item.AssignedUnitId, db, ct))
            return Results.NotFound();
        var text = request.Text?.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 10_000)
            return Validation("text", "Enter a comment of 1 to 10,000 characters.");
        var hash = Hash("work-item.comment", new { itemId, text });
        if (await Replay(machineId, hash, context, db, ct) is { } replay) return replay;
        var machineName = await db.ApiMachineIdentities.Where(x => x.Id == machineId)
            .Select(x => x.Name).SingleAsync(ct);
        var now = DateTimeOffset.UtcNow;
        var comment = WorkItemComment.FromMachine(Guid.NewGuid(), item.SiteId, item.Id,
            machineId, machineName, text, now);
        db.WorkItemComments.Add(comment);
        AddIdempotency(db, machineId, context, hash, comment.Id, now);
        await OperationalApiActivity.Record(db, machineId, item.SiteId, "comment.created", "comment",
            comment.Id, item.Id, new { }, context, now, "comment.created", ct);
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException exception) when (IsIdempotencyConflict(exception))
        {
            db.ChangeTracker.Clear();
            return await Replay(machineId, hash, context, db, ct) ??
                Problem(context, 409, "idempotency_conflict", "The request was processed concurrently. Retry with the same key.");
        }
        context.Response.Headers.Location = $"/api/v1/work/items/{item.Id}/comments/{comment.Id}";
        return Results.Json(new { comment.Id }, statusCode: StatusCodes.Status201Created);
    }

    private static async Task<IResult> Transition(Guid itemId, TransitionRequest request,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!OperationalApiEndpoints.MachineId(context.User, out var machineId)) return Results.Unauthorized();
        var hash = Hash("work-item.transition", new { itemId, request });
        if (await Replay(machineId, hash, context, db, ct) is { } replay) return replay;
        var access = await WritableItem(itemId, context, db, ct);
        if (access.Error is not null) return access.Error;
        var item = access.Item!;
        var next = request.Status?.Trim();
        if (next is null || !ValidMachineTransition(item.Status, next))
            return Conflict("This status transition requires a human workflow or is not allowed from the current status.");
        if (next != item.Status && await WorkItemDependencyEndpoints.IsBlocked(item.Id, db, ct))
            return Conflict("The task is blocked until all dependencies are completed.");
        if (item.Status == "registered" && next == "under_review" &&
            (request.Priority is null || !Priorities.Contains(request.Priority)))
            return Validation("priority", "Select a valid priority when accepting registered work.");
        if (next is "on_hold" or "rejected" && string.IsNullOrWhiteSpace(request.DecisionNote))
            return Validation("decisionNote", "A rationale is required.");
        var previous = item.Status;
        var now = DateTimeOffset.UtcNow;
        if (previous == "registered" && next == "under_review") item.SetPriority(request.Priority!, now);
        item.TransitionWithinLevel(next, request.DecisionNote, now);
        AddIdempotency(db, machineId, context, hash, item.Id, now);
        var activity = previous == "registered" && next == "under_review"
            ? "assignment.accepted" : previous is "rejected" or "on_hold" && next == "under_review"
                ? "assignment.reopened" : "assignment.updated";
        await OperationalApiActivity.Record(db, access.MachineId, item.SiteId, activity, "task", item.Id,
            item.Id, new { status = next, previousStatus = previous }, context, now, activity, ct);
        return await SaveVersioned(item, context, db, ct);
    }

    private static bool ValidMachineTransition(string current, string next) => current == next ||
        (current, next) is ("registered", "under_review") or
            ("under_review", "on_hold") or ("under_review", "rejected") or
            ("on_hold", "under_review") or ("rejected", "under_review");

    private static async Task<WritableAccess> WritableItem(Guid itemId, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!OperationalApiEndpoints.MachineId(context.User, out var machineId))
            return new(machineId, null, Results.Unauthorized());
        var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null || !await OperationalApiEndpoints.HasGrant(machineId, item.SiteId, item.AssignedUnitId, db, ct))
            return new(machineId, null, Results.NotFound());
        if (!ExpectedVersion(context, db.Entry(item).Property<uint>("xmin").CurrentValue, out var error))
            return new(machineId, null, error);
        return new(machineId, item, null);
    }

    private static async Task<IResult> SaveVersioned(WorkItem item, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        { return Problem(context, 409, "version_conflict", "The work item changed. Read it again and retry."); }
        var version = db.Entry(item).Property<uint>("xmin").CurrentValue;
        context.Response.Headers.ETag = ETag(version);
        return Results.Ok(new { item.Id, item.ReferenceCode, item.Status, version });
    }

    private static IResult? ValidateContent(string? title, string? description, string? recommendation,
        string? referenceUrl, string? priority)
    {
        var errors = new Dictionary<string, string[]>();
        if ((title ?? "").Trim().Length is < 2 or > 200) errors["title"] = ["The title must be between 2 and 200 characters."];
        if ((description ?? "").Trim().Length > 10_000) errors["description"] = ["The description can contain at most 10,000 characters."];
        if (Normalize(recommendation) is { Length: > 4_000 }) errors["recommendation"] = ["The recommendation can contain at most 4,000 characters."];
        if (!Priorities.Contains(priority ?? "")) errors["priority"] = ["Select low, normal, high, or critical."];
        if (!WorkLinkPolicy.TryNormalize(referenceUrl, out _)) errors["referenceUrl"] = ["Use an allowed link without embedded credentials."];
        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    private static async Task<bool> ActiveLevel(Guid siteId, Guid? unitId, FylkrenDbContext db, CancellationToken ct) =>
        await db.Sites.AnyAsync(x => x.Id == siteId && x.IsActive, ct) &&
        (unitId is null || await db.OrganizationUnits.AnyAsync(x => x.Id == unitId && x.SiteId == siteId && x.IsActive, ct));

    private static async Task<bool> ValidLookup(Guid siteId, Guid? id, string kind,
        FylkrenDbContext db, CancellationToken ct) => id is null || await db.WorkItemLookups
        .AnyAsync(x => x.Id == id && x.SiteId == siteId && x.Kind == kind && x.IsActive, ct);

    internal static async Task<IResult?> Replay(Guid machineId, string hash, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        var key = context.Request.Headers["Idempotency-Key"].ToString().Trim();
        if (!ValidIdempotencyKey(key))
            return Problem(context, 400, "invalid_idempotency_key", "Idempotency-Key must contain 8–128 permitted characters.");
        var record = await db.ApiIdempotencyRecords.AsNoTracking().SingleOrDefaultAsync(x =>
            x.MachineIdentityId == machineId && x.Key == key, ct);
        if (record is null) return null;
        return record.RequestHash == hash
            ? Results.Ok(new { id = record.ResourceId, replayed = true })
            : Problem(context, 409, "idempotency_key_reused", "Idempotency-Key has already been used with different content.");
    }

    internal static void AddIdempotency(FylkrenDbContext db, Guid machineId, HttpContext context,
        string hash, Guid resourceId, DateTimeOffset now) => db.ApiIdempotencyRecords.Add(
        new ApiIdempotencyRecord(Guid.NewGuid(), machineId,
            context.Request.Headers["Idempotency-Key"].ToString().Trim(), hash, resourceId, now));

    private static bool ExpectedVersion(HttpContext context, uint current, out IResult? error)
    {
        var raw = context.Request.Headers.IfMatch.ToString().Trim();
        if (raw.Length < 3 || raw[0] != '"' || raw[^1] != '"' || !uint.TryParse(raw[1..^1], out var expected))
        { error = Problem(context, 428, "if_match_required", "Use the ETag from the latest work-item read in If-Match."); return false; }
        if (expected != current)
        { error = Problem(context, 409, "version_conflict", "The work item changed. Read it again and retry."); return false; }
        error = null; return true;
    }

    private static bool ValidIdempotencyKey(string key) => key.Length is >= 8 and <= 128 &&
        key.All(character => char.IsAsciiLetterOrDigit(character) || "._:-".Contains(character));
    internal static bool IsIdempotencyConflict(DbUpdateException exception) =>
        exception.InnerException is Npgsql.PostgresException { SqlState: Npgsql.PostgresErrorCodes.UniqueViolation,
            ConstraintName: "IX_api_idempotency_records_machine_identity_id_key" };
    internal static string Hash(string operation, object request) => Convert.ToHexString(SHA256.HashData(
        Encoding.UTF8.GetBytes(JsonSerializer.Serialize(new { operation, request })))).ToLowerInvariant();
    private static string? Normalize(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    private static string ETag(uint version) => $"\"{version}\"";
    internal static IResult Validation(string field, string message) => Results.ValidationProblem(
        new Dictionary<string, string[]> { [field] = [message] });
    private static IResult Forbidden(string title) => Results.Problem(statusCode: 403, title: title);
    private static IResult Conflict(string title) => Results.Conflict(new { error = title });
    internal static IResult Problem(HttpContext context, int status, string code, string detail) =>
        Results.Problem(statusCode: status, title: detail, extensions: new Dictionary<string, object?>
        { ["code"] = code, ["traceId"] = context.TraceIdentifier });
    private sealed record WritableAccess(Guid MachineId, WorkItem? Item, IResult? Error);
}

internal static class OperationalApiActivity
{
    internal static async Task Record(FylkrenDbContext db, Guid machineId, Guid siteId,
        string activityType, string resourceType, Guid resourceId, Guid workItemId, object metadata,
        HttpContext http, DateTimeOffset now, string? webhookType, CancellationToken ct)
    {
        var audit = new ApiMachineAuditEvent(Guid.NewGuid(), machineId, siteId, activityType,
            resourceType, resourceId, http.TraceIdentifier, now);
        db.ApiMachineAuditEvents.Add(audit);
        var instance = await db.InstanceIdentities.AsNoTracking().Where(x => x.Key == 1)
            .Select(x => x.InstanceId).SingleAsync(ct);
        var eventContext = new DomainEventContext("local", "machine", instance, siteId,
            db.ActivityOperationId, ActorMachineId: machineId, CorrelationId: db.ActivityOperationId,
            RequestId: http.TraceIdentifier);
        var domainEvent = DomainEvent.Create(Guid.NewGuid(), activityType, siteId, resourceType,
            resourceId, workItemId, eventContext, JsonSerializer.Serialize(metadata), now,
            DateTimeOffset.UtcNow, audit.Id.ToString("N"), webhookType,
            JsonSerializer.Serialize(new { workItemId, status = MetadataStatus(metadata) }));
        DomainEventRecorder.StoreActivity(db, domainEvent, null, notificationsSkipped: false,
            webhooksSkipped: webhookType is null);
        audit.Correlate(domainEvent.Id);
    }

    private static string? MetadataStatus(object metadata)
    {
        using var value = JsonDocument.Parse(JsonSerializer.Serialize(metadata));
        return value.RootElement.TryGetProperty("status", out var status) && status.ValueKind == JsonValueKind.String
            ? status.GetString() : null;
    }
}
