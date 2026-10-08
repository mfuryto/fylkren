using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.WorkManagement;
using Fylkren.Api.Approvals;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.Decisions;

public static class DecisionEndpoints
{
    private static readonly HashSet<string> Statuses = ["draft", "recorded", "withdrawn"];
    private static readonly HashSet<string> ReferenceTypes = ["work_item", "assignment", "plan", "execution"];

    public static IEndpointRouteBuilder MapDecisionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/decisions").RequireAuthorization();
        group.MapGet("/sites/{siteId:guid}/tasks/{itemId:guid}", GetForTask);
        group.MapPost("/sites/{siteId:guid}/tasks/{itemId:guid}", CreateForTask);
        group.MapPut("/{decisionId:guid}", Revise);
        return endpoints;
    }

    private static async Task<IResult> GetForTask(Guid siteId, Guid itemId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId) || !await IsMember(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (!await LeadsSiteRoot(siteId, personId, db, ct) && !await CanReadWorkTree(siteId, itemId, personId, db, ct)) return Results.Problem(statusCode: 403);
        var decisions = await db.Decisions.AsNoTracking().AsSplitQuery()
            .Where(value => value.SiteId == siteId && value.Revisions.Any(revision => revision.References.Any(reference => reference.ObjectType == "work_item" && reference.ObjectId == itemId)))
            .Include(value => value.Revisions).ThenInclude(value => value.Makers)
            .Include(value => value.Revisions).ThenInclude(value => value.References)
            .Include(value => value.Revisions).ThenInclude(value => value.RecordedByPerson)
            .Include(value => value.Revisions).ThenInclude(value => value.RecordedByMachine)
            .OrderByDescending(value => value.CreatedAt)
            .ToListAsync(ct);
        return Results.Ok(decisions.Select(ToResponse));
    }

    private static async Task<IResult> CreateForTask(Guid siteId, Guid itemId, DecisionRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var item = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == itemId && value.SiteId == siteId, ct);
        if (item is null) return Results.NotFound();
        if (!await CanManageItem(item, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (Validate(request) is { } error) return error;
        var makers = await ResolveMakers(siteId, request.DecisionMakerIds, personId, db, ct);
        if (makers is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["decisionMakerIds"] = ["All decision-makers must be active members of the site."] });
        var references = NormalizeReferences(itemId, request.References);
        if (!await ReferencesAreValid(siteId, references, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["references"] = ["One or more object references are invalid or belong to another site."] });

        var now = DateTimeOffset.UtcNow;
        var decision = new Decision(Guid.NewGuid(), siteId, personId, now);
        var revision = CreateRevision(decision.Id, 1, request, personId, now, makers, references);
        db.Decisions.Add(decision);
        db.DecisionRevisions.Add(revision);
        if (request.Status == "recorded")
            await FormalApprovalService.Approve(db, siteId, "decision", decision.Id, itemId, request.Title!, new { revision = 1, title = request.Title, decision = request.Decision, request.Rationale, request.Status, decidedAt = request.DecidedAt ?? now, decisionMakers = makers.Select(x => new { personId = x.Id, displayName = x.Name }), references }, personId, now, ct);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), siteId, personId, "decision.created", "decision", decision.Id, now), "decision.created", workItemId: itemId, resourceType: "decision", metadataJson: System.Text.Json.JsonSerializer.Serialize(new { revision = 1, status = request.Status }));
        DomainEventRecorder.Record(db, "decision.recorded", siteId, personId, "decision", decision.Id, new { decisionId = decision.Id, taskId = itemId, revision = 1, status = request.Status }, now);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/decisions/{decision.Id}", new { decision.Id, revision = 1 });
    }

    private static async Task<IResult> Revise(Guid decisionId, ReviseDecisionRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var decision = await db.Decisions.Include(value => value.Revisions).ThenInclude(value => value.References).SingleOrDefaultAsync(value => value.Id == decisionId, ct);
        if (decision is null) return Results.NotFound();
        var latest = decision.Revisions.OrderByDescending(value => value.RevisionNumber).First();
        if (latest.RevisionNumber != request.ExpectedRevision) return Results.Conflict(new { error = "The decision was changed by another user. Load the latest version before trying again." });
        var taskId = latest.References.FirstOrDefault(value => value.ObjectType == "work_item")?.ObjectId;
        if (taskId is not Guid itemId) return Results.Conflict(new { error = "The decision lacks task context and cannot be changed from the task view." });
        var item = await db.WorkItems.SingleOrDefaultAsync(value => value.Id == itemId && value.SiteId == decision.SiteId, ct);
        if (item is null || !await CanManageItem(item, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (Validate(request) is { } error) return error;
        var makers = await ResolveMakers(decision.SiteId, request.DecisionMakerIds, personId, db, ct);
        if (makers is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["decisionMakerIds"] = ["All decision-makers must be active members of the site."] });
        var references = NormalizeReferences(itemId, request.References);
        if (!await ReferencesAreValid(decision.SiteId, references, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["references"] = ["One or more object references are invalid or belong to another site."] });

        var now = DateTimeOffset.UtcNow;
        var revision = CreateRevision(decision.Id, NumericBounds.NextVersion(latest.RevisionNumber), request, personId, now, makers, references);
        db.DecisionRevisions.Add(revision);
        if (request.Status == "recorded")
            await FormalApprovalService.Approve(db, decision.SiteId, "decision", decision.Id, itemId, request.Title!, new { revision = revision.RevisionNumber, title = request.Title, decision = request.Decision, request.Rationale, request.Status, decidedAt = request.DecidedAt ?? now, decisionMakers = makers.Select(x => new { personId = x.Id, displayName = x.Name }), references }, personId, now, ct);
        WorkActivity.Add(db, new AuditEvent(Guid.NewGuid(), decision.SiteId, personId, "decision.revised", "decision", decision.Id, now), "decision.updated", workItemId: itemId, resourceType: "decision", metadataJson: System.Text.Json.JsonSerializer.Serialize(new { revision = revision.RevisionNumber, status = request.Status, previousStatus = latest.Status }));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException exception) when (exception.InnerException is Npgsql.PostgresException { SqlState: "23505" }) { return Results.Conflict(new { error = "The decision was changed concurrently. Load the latest version and try again." }); }
        return Results.Ok(new { decision.Id, revision = revision.RevisionNumber });
    }

    private static IResult? Validate(DecisionRequest request)
    {
        var errors = new Dictionary<string, string[]>();
        if ((request.Title ?? "").Trim().Length is < 2 or > 200) errors["title"] = ["The title must be between 2 and 200 characters."];
        if ((request.Decision ?? "").Trim().Length is < 2 or > 10000) errors["decision"] = ["The decision must be between 2 and 10,000 characters."];
        if ((request.Rationale ?? "").Trim().Length is < 2 or > 10000) errors["rationale"] = ["The rationale must be between 2 and 10,000 characters."];
        if (!Statuses.Contains(request.Status ?? "")) errors["status"] = ["Select a valid decision status."];
        if (request.References?.Count > 20 || request.DecisionMakerIds?.Count > 20) errors["decision"] = ["A decision can have at most 20 decision-makers and 20 references."];
        if (request.References?.Any(value => value is null) == true) errors["references"] = ["Decision references cannot contain empty entries."];
        return errors.Count == 0 ? null : Results.ValidationProblem(errors);
    }

    private static DecisionRevision CreateRevision(Guid decisionId, int number, DecisionRequest request, Guid actorId, DateTimeOffset now, IReadOnlyList<(Guid Id, string Name)> makers, IReadOnlyList<DecisionReferenceRequest> references)
    {
        var revision = new DecisionRevision(Guid.NewGuid(), decisionId, number, request.Title!, request.Decision!, request.Rationale!, request.Status!, request.DecidedAt ?? now, actorId, now);
        foreach (var maker in makers) revision.Makers.Add(new DecisionMaker(revision.Id, maker.Id, maker.Name));
        foreach (var reference in references) revision.References.Add(new DecisionReference(Guid.NewGuid(), revision.Id, reference.ObjectType, reference.ObjectId));
        return revision;
    }

    private static async Task<IReadOnlyList<(Guid Id, string Name)>?> ResolveMakers(Guid siteId, IReadOnlyList<Guid>? requested, Guid actorId, FylkrenDbContext db, CancellationToken ct)
    {
        var ids = (requested is { Count: > 0 } ? requested : [actorId]).Distinct().ToArray();
        var makers = await db.SiteMemberships.AsNoTracking().Where(value => value.SiteId == siteId && value.IsActive && value.Person.IsActive && ids.Contains(value.PersonId)).Select(value => new { value.PersonId, value.Person.DisplayName }).ToListAsync(ct);
        return makers.Count == ids.Length ? makers.Select(value => (value.PersonId, value.DisplayName)).ToList() : null;
    }

    private static IReadOnlyList<DecisionReferenceRequest> NormalizeReferences(Guid itemId, IReadOnlyList<DecisionReferenceRequest>? requested) =>
        (requested ?? []).Append(new DecisionReferenceRequest("work_item", itemId)).DistinctBy(value => (value.ObjectType, value.ObjectId)).ToList();

    private static async Task<bool> ReferencesAreValid(Guid siteId, IReadOnlyList<DecisionReferenceRequest> references, FylkrenDbContext db, CancellationToken ct)
    {
        if (references.Any(value => !ReferenceTypes.Contains(value.ObjectType))) return false;
        foreach (var reference in references)
        {
            var valid = reference.ObjectType switch
            {
                "work_item" or "assignment" => await db.WorkItems.AnyAsync(value => value.Id == reference.ObjectId && value.SiteId == siteId, ct),
                "plan" => await db.WorkflowRuns.AnyAsync(value => value.Id == reference.ObjectId && value.WorkItem.SiteId == siteId, ct),
                "execution" => await db.ExecutionRuns.AnyAsync(value => value.Id == reference.ObjectId && value.WorkItem.SiteId == siteId, ct),
                _ => false
            };
            if (!valid) return false;
        }
        return true;
    }

    private static object ToResponse(Decision decision)
    {
        var revisions = decision.Revisions.OrderByDescending(value => value.RevisionNumber).Select(value => new
        {
            value.Id, value.RevisionNumber, value.Title, decision = value.DecisionText, value.Rationale, value.Status,
            value.DecidedAt, value.RecordedAt,
            recordedBy = value.RecordedByPerson?.DisplayName ?? value.RecordedByMachine?.Name ?? "System",
            decisionMakers = value.Makers.OrderBy(maker => maker.DisplayNameSnapshot).Select(maker => new { maker.PersonId, displayName = maker.DisplayNameSnapshot }),
            references = value.References.Select(reference => new { reference.Id, reference.ObjectType, reference.ObjectId })
        }).ToList();
        return new { decision.Id, decision.SiteId, decision.CreatedAt, current = revisions.First(), revisions };
    }

    private sealed record DecisionReferenceRequest(string ObjectType, Guid ObjectId);
    private record DecisionRequest(string? Title, string? Decision, string? Rationale, string? Status, DateTimeOffset? DecidedAt, IReadOnlyList<Guid>? DecisionMakerIds, IReadOnlyList<DecisionReferenceRequest>? References);
    private sealed record ReviseDecisionRequest(int ExpectedRevision, string? Title, string? Decision, string? Rationale, string? Status, DateTimeOffset? DecidedAt, IReadOnlyList<Guid>? DecisionMakerIds, IReadOnlyList<DecisionReferenceRequest>? References)
        : DecisionRequest(Title, Decision, Rationale, Status, DecidedAt, DecisionMakerIds, References);
}
