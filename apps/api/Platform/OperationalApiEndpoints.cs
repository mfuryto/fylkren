using System.Security.Claims;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class OperationalApiEndpoints
{
    public static IEndpointRouteBuilder MapOperationalApiEndpoints(this IEndpointRouteBuilder endpoints)
    {
        WorkApiManagementEndpoints.Map(endpoints);
        var api = endpoints.MapGroup("/api/v1/work")
            .RequireAuthorization("MachineApi")
            .RequireFeature(Licensing.FeatureCatalog.MachineApi);
        api.MapGet("/catalog", Catalog).RequireScope("work:read");
        api.MapGet("/items", ListItems).RequireScope("work:read");
        api.MapGet("/items/{itemId:guid}", GetItem).RequireScope("work:read");
        api.MapGet("/items/{itemId:guid}/planning", GetPlanning).RequireScope("work:read");
        api.MapGet("/items/{itemId:guid}/execution", GetExecution).RequireScope("work:read");
        api.MapGet("/items/{itemId:guid}/decisions", GetDecisions).RequireScope("work:read");
        api.MapGet("/items/{itemId:guid}/risks", GetRisks).RequireScope("work:read");
        api.MapGet("/items/{itemId:guid}/activity", GetActivity).RequireScope("activity:read");
        api.MapGet("/items/{itemId:guid}/comments", GetComments).RequireScope("work:read");
        OperationalApiCommandEndpoints.Map(api);
        OperationalDomainCommandEndpoints.Map(api);
        return endpoints;
    }

    private static RouteHandlerBuilder RequireScope(this RouteHandlerBuilder route, string scope) =>
        route.RequireAuthorization(policy => policy.RequireClaim("scope", scope))
            .RequireRateLimiting("administration-api");

    private static async Task<IResult> Catalog(Guid siteId, ClaimsPrincipal user,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!MachineId(user, out var machineId)) return Results.Unauthorized();
        var grantedUnits = await GrantedUnits(machineId, siteId, db, ct);
        if (grantedUnits is null) return Results.Problem(statusCode: 403, title: "No work API grant exists for this site.");
        var units = await db.OrganizationUnits.AsNoTracking()
            .Where(x => x.SiteId == siteId && x.IsActive &&
                (grantedUnits.Contains(x.Id) || grantedUnits.Contains(null) && (x.IsSiteRoot || x.IsSiteLeadership)))
            .OrderBy(x => x.SortOrder).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.ParentId, x.Name, x.IsSiteLeadership, x.SortOrder }).ToListAsync(ct);
        var types = await db.WorkItemTypes.AsNoTracking().Where(x => x.SiteId == siteId && x.IsActive)
            .OrderBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Abbreviation }).ToListAsync(ct);
        var lookups = await db.WorkItemLookups.AsNoTracking().Where(x => x.SiteId == siteId && x.IsActive)
            .OrderBy(x => x.Kind).ThenBy(x => x.Name).Select(x => new { x.Id, x.Kind, x.Name }).ToListAsync(ct);
        var workflows = await db.WorkflowDefinitions.AsNoTracking()
            .Where(x => x.SiteId == siteId && x.IsActive && (x.OwnerUnitId == null || grantedUnits.Contains(x.OwnerUnitId)))
            .OrderBy(x => x.Kind).ThenBy(x => x.Name)
            .Select(x => new { x.Id, x.OwnerUnitId, x.Name, x.Kind }).ToListAsync(ct);
        return Results.Ok(new { siteId, units, workItemTypes = types, lookups, workflows });
    }

    private static async Task<IResult> ListItems(Guid siteId, Guid? unitId, string? status,
        string? search, int? page, int? pageSize, ClaimsPrincipal user, FylkrenDbContext db,
        CancellationToken ct)
    {
        if (!MachineId(user, out var machineId)) return Results.Unauthorized();
        if (RequestQueryPolicy.Validate(page, search, pageSize) is { } error) return error;
        if (!await HasGrant(machineId, siteId, unitId, db, ct))
            return Results.Problem(statusCode: 403, title: "The API client has no grant for this exact work level.");
        if (status is { Length: > 30 }) return Validation("status", "Status can contain at most 30 characters.");
        var query = db.WorkItems.AsNoTracking().Where(x => x.SiteId == siteId && x.AssignedUnitId == unitId);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(x => x.Status == status);
        if (!string.IsNullOrWhiteSpace(search))
        {
            var pattern = RequestQueryPolicy.LikePattern(search);
            query = query.Where(x => EF.Functions.ILike(x.ReferenceCode, pattern, "\\") ||
                EF.Functions.ILike(x.Title, pattern, "\\") || EF.Functions.ILike(x.Description, pattern, "\\"));
        }
        var number = page ?? 1;
        var size = pageSize ?? 50;
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderByDescending(x => x.UpdatedAt).ThenBy(x => x.Id)
            .Skip((number - 1) * size).Take(size).Select(x => new
            {
                x.Id, x.ReferenceCode, x.OriginReference, x.ParentWorkItemId, x.WorkItemTypeId,
                workItemType = x.WorkItemType == null ? x.WorkItemTypeNameSnapshot : x.WorkItemType.Name,
                x.AssignedUnitId, assignedUnit = x.AssignedUnit == null ? null : x.AssignedUnit.Name,
                x.Title, x.Priority, x.Status, x.DueAt, x.CreatedAt, x.UpdatedAt,
                version = EF.Property<uint>(x, "xmin")
            }).ToListAsync(ct);
        return Results.Ok(new { items, page = number, pageSize = size, total,
            totalPages = Math.Max(1L, NumericBounds.Pages(total, size)) });
    }

    private static async Task<IResult> GetItem(Guid itemId, ClaimsPrincipal user,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        var item = access.Item!;
        var dependencies = await db.WorkItemDependencies.AsNoTracking()
            .Where(x => x.DependentWorkItemId == itemId || x.PredecessorWorkItemId == itemId)
            .OrderBy(x => x.CreatedAt).Select(x => new
            { x.Id, x.Type, x.PredecessorWorkItemId, x.DependentWorkItemId, x.CreatedAt }).ToListAsync(ct);
        var children = await db.WorkItems.AsNoTracking().Where(x => x.ParentWorkItemId == itemId)
            .OrderBy(x => x.CreatedAt).Select(x => new
            { x.Id, x.ReferenceCode, x.Title, x.SiteId, x.AssignedUnitId, x.Status }).ToListAsync(ct);
        var version = db.Entry(item).Property<uint>("xmin").CurrentValue;
        context.Response.Headers.ETag = $"\"{version}\"";
        return Results.Ok(new
        {
            item.Id, item.SiteId, item.ReferenceCode, item.OriginReference, item.ParentWorkItemId,
            item.WorkItemTypeId, workItemType = item.WorkItemType?.Name ?? item.WorkItemTypeNameSnapshot,
            item.SourceTypeId, sourceType = item.SourceType?.Name ?? item.SourceTypeNameSnapshot,
            item.SenderId, sender = item.Sender?.Name ?? item.SenderNameSnapshot,
            item.AssignedUnitId, assignedUnit = item.AssignedUnit?.Name, item.Title, item.Description,
            item.Recommendation, item.ReferenceUrl, item.Priority, item.Status, item.DueAt,
            item.DecisionNote, item.CreatedAt, item.UpdatedAt, version, dependencies, children
        });
    }

    private static async Task<IResult> GetPlanning(Guid itemId, ClaimsPrincipal user,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        var run = await db.WorkflowRuns.AsNoTracking().Where(x => x.WorkItemId == itemId)
            .Select(x => new { x.Id, x.DefinitionId, definition = x.Definition.Name, x.Status,
                x.CurrentStep, x.StartedAt, x.TimelineStartedOn, x.ProposedUnitId,
                proposedUnit = x.ProposedUnit == null ? null : x.ProposedUnit.Name,
                x.ProposedPriority, x.ProposedDueAt, x.ResultNote, version = EF.Property<uint>(x, "xmin") }).SingleOrDefaultAsync(ct);
        if (run is null) return Results.NotFound();
        var steps = await db.WorkflowSteps.AsNoTracking().Where(x => x.DefinitionId == run.DefinitionId)
            .OrderBy(x => x.SortOrder).Select(x => new { x.Id, x.Name, x.SortOrder, x.IsOptional,
                x.AllowsTaskAllocation, x.HasTimeline }).ToListAsync(ct);
        var documents = await db.WorkflowStepDocuments.AsNoTracking().Where(x => x.RunId == run.Id)
            .OrderBy(x => x.Step.SortOrder).Select(x => new { x.Id, x.StepId, x.Content, x.UpdatedAt }).ToListAsync(ct);
        var timeline = await db.WorkflowTimelineEvents.AsNoTracking().Where(x => x.RunId == run.Id)
            .OrderBy(x => x.Date).ThenBy(x => x.SortOrder)
            .Select(x => new { x.Id, x.StepId, x.Date, x.Description, x.SortOrder }).ToListAsync(ct);
        context.Response.Headers.ETag = $"\"{run.version}\"";
        return Results.Ok(new { run, steps, documents, timeline });
    }

    private static async Task<IResult> GetExecution(Guid itemId, ClaimsPrincipal user,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        var run = await db.ExecutionRuns.AsNoTracking().Where(x => x.WorkItemId == itemId)
            .Select(x => new { x.Id, x.DefinitionId, definition = x.Definition == null ? null : x.Definition.Name,
                x.Status, x.CurrentStep, x.TimelineStartedOn, x.ClaimedAt, x.UpdatedAt,
                version = EF.Property<uint>(x, "xmin") }).SingleOrDefaultAsync(ct);
        if (run is null) return Results.NotFound();
        var steps = run.DefinitionId is null ? [] : await db.WorkflowSteps.AsNoTracking()
            .Where(x => x.DefinitionId == run.DefinitionId).OrderBy(x => x.SortOrder)
            .Select(x => new { x.Id, x.Name, x.SortOrder, x.IsOptional, x.HasTimeline }).ToListAsync(ct);
        var documents = await db.ExecutionStepDocuments.AsNoTracking().Where(x => x.RunId == run.Id)
            .OrderBy(x => x.Step.SortOrder).Select(x => new { x.Id, x.StepId, x.Content, x.UpdatedAt }).ToListAsync(ct);
        var requests = await db.ExecutionExternalRequests.AsNoTracking().Where(x => x.RunId == run.Id)
            .OrderBy(x => x.CreatedAt).Select(x => new { x.Id, x.StepId, x.Recipient, x.RequestText,
                x.ResponseText, x.Status, x.CreatedAt, x.UpdatedAt }).ToListAsync(ct);
        var timeline = await db.ExecutionTimelineEvents.AsNoTracking().Where(x => x.RunId == run.Id)
            .OrderBy(x => x.Date).ThenBy(x => x.SortOrder)
            .Select(x => new { x.Id, x.StepId, x.Date, x.Description, x.SortOrder }).ToListAsync(ct);
        context.Response.Headers.ETag = $"\"{run.version}\"";
        return Results.Ok(new { run, steps, documents, requests, timeline });
    }

    private static async Task<IResult> GetDecisions(Guid itemId, ClaimsPrincipal user,
        FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        var ids = await db.DecisionReferences.AsNoTracking().Where(x => x.ObjectType == "work_item" && x.ObjectId == itemId)
            .Select(x => x.Revision.DecisionId).Distinct().Take(200).ToListAsync(ct);
        var revisions = await db.DecisionRevisions.AsNoTracking().Where(x => ids.Contains(x.DecisionId))
            .OrderBy(x => x.DecisionId).ThenByDescending(x => x.RevisionNumber)
            .Select(x => new { x.Id, x.DecisionId, x.RevisionNumber, x.Title, x.DecisionText, x.Rationale,
                x.Status, x.DecidedAt, x.RecordedAt, x.RecordedByPersonId, x.RecordedByMachineId,
                makers = x.Makers.OrderBy(m => m.DisplayNameSnapshot).Select(m => new { m.PersonId, m.DisplayNameSnapshot }) })
            .ToListAsync(ct);
        return Results.Ok(new { items = revisions.GroupBy(x => x.DecisionId).Select(x => x.First()) });
    }

    private static async Task<IResult> GetRisks(Guid itemId, ClaimsPrincipal user,
        FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        var risks = await db.Risks.AsNoTracking().Where(x => x.ObjectType == "task" && x.ObjectId == itemId)
            .OrderBy(x => x.CreatedAt).Take(200).Select(x => new
            {
                x.Id, x.CreatedAt,
                revisions = x.Revisions.OrderByDescending(v => v.Version).Select(v => new { v.Id, v.Version,
                    v.Title, v.Description, v.Probability, v.Impact, v.Score, v.Level, v.OwnerPersonId,
                    v.OwnerNameSnapshot, v.Status, v.DueDate, v.ResidualProbability, v.ResidualImpact,
                    v.ResidualScore, v.ResidualLevel, v.RecordedAt, v.RecordedByPersonId, v.RecordedByMachineId }),
                mitigations = x.Mitigations.OrderBy(m => m.CreatedAt).Select(m => new { m.Id, m.CreatedAt,
                    revisions = m.Revisions.OrderByDescending(v => v.Version).Select(v => new { v.Id, v.Version,
                        v.Action, v.OwnerPersonId, v.OwnerNameSnapshot, v.Status, v.DueDate, v.RecordedAt,
                        v.RecordedByPersonId, v.RecordedByMachineId }) })
            }).ToListAsync(ct);
        return Results.Ok(new { items = risks.Select(x => new { x.Id, x.CreatedAt,
            current = x.revisions.FirstOrDefault(), mitigations = x.mitigations.Select(m => new
            { m.Id, m.CreatedAt, current = m.revisions.FirstOrDefault() }) }) });
    }

    private static async Task<IResult> GetActivity(Guid itemId, string? eventType, DateTimeOffset? from,
        DateTimeOffset? until, int? limit, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        if (limit is < 1 or > 100) return Validation("limit", "Limit must be between 1 and 100.");
        if (eventType is { Length: > 100 }) return Validation("eventType", "Event type can contain at most 100 characters.");
        if (from is not null && until is not null && from > until) return Validation("period", "From must not be after until.");
        var query = db.DomainEvents.AsNoTracking().Where(x => x.SiteId == access.Item!.SiteId &&
            (x.ContextWorkItemId == itemId || x.ResourceId == itemId));
        if (!string.IsNullOrWhiteSpace(eventType)) query = query.Where(x => x.ActivityType == eventType || x.EventType == eventType);
        if (from is not null) query = query.Where(x => x.OccurredAt >= from);
        if (until is not null) query = query.Where(x => x.OccurredAt <= until);
        var items = await query.OrderByDescending(x => x.OccurredAt).ThenByDescending(x => x.Id)
            .Take(limit ?? 50).Select(x => new { x.Id, eventType = x.ActivityType ?? x.EventType,
                x.OccurredAt, x.RecordedAt, x.Source, x.ActorKind, x.ActorPersonId, x.ActorMachineId,
                x.ActorSystem, x.ResourceType, x.ResourceId, x.ContextWorkItemId, x.CorrelationId,
                x.CausationEventId, x.RequestId }).ToListAsync(ct);
        return Results.Ok(new { items });
    }

    private static async Task<IResult> GetComments(Guid itemId, int? page, int? pageSize,
        ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await LoadAccess(itemId, user, db, ct);
        if (access.Error is not null) return access.Error;
        if (RequestQueryPolicy.Validate(page, null, pageSize) is { } error) return error;
        var number = page ?? 1; var size = pageSize ?? 50;
        var query = db.WorkItemComments.AsNoTracking().Where(x => x.WorkItemId == itemId);
        var total = await query.LongCountAsync(ct);
        var items = await query.OrderByDescending(x => x.CreatedAt).ThenByDescending(x => x.Id)
            .Skip((number - 1) * size).Take(size).Select(x => new
            {
                x.Id, x.AuthorPersonId, x.AuthorMachineId, x.AuthorName, x.Text, x.CreatedAt
            }).ToListAsync(ct);
        return Results.Ok(new { items, page = number, pageSize = size, total,
            totalPages = Math.Max(1L, NumericBounds.Pages(total, size)) });
    }

    private static async Task<AccessResult> LoadAccess(Guid itemId, ClaimsPrincipal user,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!MachineId(user, out var machineId)) return new(null, Results.Unauthorized());
        var item = await db.WorkItems.Include(x => x.WorkItemType).Include(x => x.SourceType)
            .Include(x => x.Sender).Include(x => x.AssignedUnit).SingleOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null) return new(null, Results.NotFound());
        return await HasGrant(machineId, item.SiteId, item.AssignedUnitId, db, ct)
            ? new(item, null) : new(null, Results.NotFound());
    }

    internal static async Task<bool> HasGrant(Guid machineId, Guid siteId, Guid? unitId,
        FylkrenDbContext db, CancellationToken ct) => await db.ApiWorkGrants.AsNoTracking().AnyAsync(x =>
            x.MachineIdentityId == machineId && x.SiteId == siteId && x.OrganizationUnitId == unitId, ct);

    private static async Task<List<Guid?>?> GrantedUnits(Guid machineId, Guid siteId,
        FylkrenDbContext db, CancellationToken ct)
    {
        var values = await db.ApiWorkGrants.AsNoTracking().Where(x =>
            x.MachineIdentityId == machineId && x.SiteId == siteId)
            .Select(x => x.OrganizationUnitId).ToListAsync(ct);
        return values.Count == 0 ? null : values;
    }

    internal static bool MachineId(ClaimsPrincipal user, out Guid id) =>
        Guid.TryParse(user.FindFirstValue("fylkren:machine_id"), out id);

    private static IResult Validation(string field, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [field] = [message] });

    private sealed record AccessResult(WorkManagement.WorkItem? Item, IResult? Error);
}
