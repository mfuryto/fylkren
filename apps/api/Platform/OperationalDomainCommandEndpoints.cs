using Fylkren.Api.Decisions;
using Fylkren.Api.InformationLifecycle;
using Fylkren.Api.Persistence;
using Fylkren.Api.Risks;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

internal static class OperationalDomainCommandEndpoints
{
    private static readonly HashSet<string> RiskStatuses = ["identified", "active", "mitigating"];
    private static readonly HashSet<string> MeasureStatuses = ["planned", "in_progress"];

    internal static void Map(RouteGroupBuilder api)
    {
        api.MapPost("/items/{itemId:guid}/decisions", CreateDecision).RequireScope("decisions:write");
        api.MapPut("/items/{itemId:guid}/decisions/{decisionId:guid}", ReviseDecision).RequireScope("decisions:write");
        api.MapPost("/items/{itemId:guid}/risks", CreateRisk).RequireScope("risks:write");
        api.MapPut("/items/{itemId:guid}/risks/{riskId:guid}", ReviseRisk).RequireScope("risks:write");
        api.MapPost("/items/{itemId:guid}/risks/{riskId:guid}/measures", CreateMeasure).RequireScope("risks:write");
        api.MapPut("/items/{itemId:guid}/risks/{riskId:guid}/measures/{measureId:guid}", ReviseMeasure).RequireScope("risks:write");
        api.MapPut("/items/{itemId:guid}/planning/steps/{stepId:guid}", UpdatePlanningDocument).RequireScope("planning:write");
        api.MapPut("/items/{itemId:guid}/execution/steps/{stepId:guid}", UpdateExecutionDocument).RequireScope("execution:write");
    }

    private static RouteHandlerBuilder RequireScope(this RouteHandlerBuilder route, string scope) =>
        route.RequireAuthorization(policy => policy.RequireClaim("scope", scope)).RequireRateLimiting("administration-api");

    private sealed record DecisionRequest(string? Title, string? Decision, string? Rationale,
        DateTimeOffset? DecidedAt, IReadOnlyList<Guid>? DecisionMakerIds, int? ExpectedRevision = null);
    private record RiskRequest(string? Title, string? Description, int Probability, int Impact,
        Guid OwnerPersonId, string? Status, DateOnly? DueDate, int? ResidualProbability,
        int? ResidualImpact, int? ExpectedVersion = null);
    private record MeasureRequest(string? Action, Guid OwnerPersonId, string? Status,
        DateOnly? DueDate, int? ExpectedVersion = null);
    private sealed record LinkRequest(string? Label, string? Url);
    private sealed record TimelineRequest(DateOnly Date, string? Description);
    private sealed record PlanningDocumentRequest(string? Content, IReadOnlyList<LinkRequest>? Links,
        IReadOnlyList<TimelineRequest>? TimelineEvents);
    private sealed record ExecutionDocumentRequest(string? Content, IReadOnlyList<TimelineRequest>? TimelineEvents);

    private static async Task<IResult> CreateDecision(Guid itemId, DecisionRequest request, HttpContext http,
        FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        if (ValidateDecision(request, false) is { } invalid) return invalid;
        var makers = await People(access.Item!.SiteId, request.DecisionMakerIds!, db, ct);
        if (makers is null) return Validation("decisionMakerIds", "Every decision-maker must be an active Site member.");
        var hash = OperationalApiCommandEndpoints.Hash("decision.create", new { itemId, request });
        if (await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) is { } replay) return replay;
        var now = DateTimeOffset.UtcNow;
        var decision = Decision.FromMachine(Guid.NewGuid(), access.Item.SiteId, access.MachineId, now);
        var revision = DecisionRevision.FromMachine(Guid.NewGuid(), decision.Id, 1, request.Title!, request.Decision!,
            request.Rationale!, request.DecidedAt ?? now, access.MachineId, now);
        foreach (var maker in makers) revision.Makers.Add(new DecisionMaker(revision.Id, maker.Id, maker.Name));
        revision.References.Add(new DecisionReference(Guid.NewGuid(), revision.Id, "work_item", itemId));
        db.Decisions.Add(decision); db.DecisionRevisions.Add(revision);
        OperationalApiCommandEndpoints.AddIdempotency(db, access.MachineId, http, hash, decision.Id, now);
        await OperationalApiActivity.Record(db, access.MachineId, access.Item.SiteId, "decision.created", "decision",
            decision.Id, itemId, new { revision = 1, status = "draft" }, http, now, null, ct);
        return await SaveCreated(db, http, access.MachineId, hash, decision.Id,
            $"/api/v1/work/items/{itemId}/decisions/{decision.Id}", new { decision.Id, revision = 1 }, ct);
    }

    private static async Task<IResult> ReviseDecision(Guid itemId, Guid decisionId, DecisionRequest request,
        HttpContext http, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        if (ValidateDecision(request, true) is { } invalid) return invalid;
        var hash = OperationalApiCommandEndpoints.Hash("decision.revise", new { itemId, decisionId, request });
        if (await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) is { } replay) return replay;
        var decision = await db.Decisions.Include(x => x.Revisions).ThenInclude(x => x.References)
            .SingleOrDefaultAsync(x => x.Id == decisionId && x.SiteId == access.Item!.SiteId, ct);
        var latest = decision?.Revisions.OrderByDescending(x => x.RevisionNumber).FirstOrDefault();
        if (latest is null || !latest.References.Any(x => x.ObjectType == "work_item" && x.ObjectId == itemId)) return Results.NotFound();
        if (latest.RevisionNumber != request.ExpectedRevision) return Conflict("The decision changed. Read it again and retry.");
        var makers = await People(access.Item!.SiteId, request.DecisionMakerIds!, db, ct);
        if (makers is null) return Validation("decisionMakerIds", "Every decision-maker must be an active Site member.");
        var now = DateTimeOffset.UtcNow; var number = NumericBounds.NextVersion(latest.RevisionNumber);
        var revision = DecisionRevision.FromMachine(Guid.NewGuid(), decision!.Id, number, request.Title!, request.Decision!, request.Rationale!, request.DecidedAt ?? now, access.MachineId, now);
        foreach (var maker in makers) revision.Makers.Add(new DecisionMaker(revision.Id, maker.Id, maker.Name));
        revision.References.Add(new DecisionReference(Guid.NewGuid(), revision.Id, "work_item", itemId));
        db.DecisionRevisions.Add(revision);
        OperationalApiCommandEndpoints.AddIdempotency(db, access.MachineId, http, hash, decision.Id, now);
        await OperationalApiActivity.Record(db, access.MachineId, access.Item.SiteId, "decision.updated", "decision", decision.Id, itemId, new { revision = number, status = "draft", previousStatus = latest.Status }, http, now, null, ct);
        try { await db.SaveChangesAsync(ct); } catch (DbUpdateException exception) when (OperationalApiCommandEndpoints.IsIdempotencyConflict(exception)) { db.ChangeTracker.Clear(); return await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) ?? Conflict("The request was processed concurrently. Retry with the same key."); } catch (DbUpdateException) { return Conflict("The decision changed concurrently. Read it again and retry."); }
        return Results.Ok(new { decision.Id, revision = number });
    }

    private static async Task<IResult> CreateRisk(Guid itemId, RiskRequest request, HttpContext http,
        FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        if (ValidateRisk(request, false) is { } invalid) return invalid;
        var owner = await Person(access.Item!.SiteId, request.OwnerPersonId, db, ct);
        if (owner is null) return Validation("ownerPersonId", "The owner must be an active Site member.");
        var hash = OperationalApiCommandEndpoints.Hash("risk.create", new { itemId, request });
        if (await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) is { } replay) return replay;
        var now = DateTimeOffset.UtcNow; var risk = Risk.FromMachine(Guid.NewGuid(), access.Item.SiteId, "task", itemId, access.MachineId, now);
        db.Risks.Add(risk); db.RiskRevisions.Add(RiskRevision.FromMachine(Guid.NewGuid(), risk.Id, 1, request.Title!, request.Description!, request.Probability, request.Impact, owner.Value.Id, owner.Value.Name, request.Status!, request.DueDate, request.ResidualProbability, request.ResidualImpact, access.MachineId, now));
        OperationalApiCommandEndpoints.AddIdempotency(db, access.MachineId, http, hash, risk.Id, now);
        await OperationalApiActivity.Record(db, access.MachineId, access.Item.SiteId, "risk.created", "risk", risk.Id, itemId, new { revision = 1, status = request.Status }, http, now, null, ct);
        return await SaveCreated(db, http, access.MachineId, hash, risk.Id, $"/api/v1/work/items/{itemId}/risks/{risk.Id}", new { risk.Id, version = 1 }, ct);
    }

    private static async Task<IResult> ReviseRisk(Guid itemId, Guid riskId, RiskRequest request, HttpContext http,
        FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        if (ValidateRisk(request, true) is { } invalid) return invalid;
        var hash = OperationalApiCommandEndpoints.Hash("risk.revise", new { itemId, riskId, request });
        if (await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) is { } replay) return replay;
        var risk = await db.Risks.Include(x => x.Revisions).SingleOrDefaultAsync(x => x.Id == riskId && x.SiteId == access.Item!.SiteId && x.ObjectType == "task" && x.ObjectId == itemId, ct);
        if (risk is null) return Results.NotFound(); var latest = risk.Revisions.Max(x => x.Version);
        if (latest != request.ExpectedVersion) return Conflict("The risk changed. Read it again and retry.");
        var owner = await Person(risk.SiteId, request.OwnerPersonId, db, ct); if (owner is null) return Validation("ownerPersonId", "The owner must be an active Site member.");
        var now = DateTimeOffset.UtcNow; var version = NumericBounds.NextVersion(latest);
        db.RiskRevisions.Add(RiskRevision.FromMachine(Guid.NewGuid(), risk.Id, version, request.Title!, request.Description!, request.Probability, request.Impact, owner.Value.Id, owner.Value.Name, request.Status!, request.DueDate, request.ResidualProbability, request.ResidualImpact, access.MachineId, now));
        OperationalApiCommandEndpoints.AddIdempotency(db, access.MachineId, http, hash, risk.Id, now);
        await OperationalApiActivity.Record(db, access.MachineId, risk.SiteId, "risk.updated", "risk", risk.Id, itemId, new { revision = version, status = request.Status, previousStatus = risk.Revisions.Single(x => x.Version == latest).Status }, http, now, null, ct);
        try { await db.SaveChangesAsync(ct); } catch (DbUpdateException exception) when (OperationalApiCommandEndpoints.IsIdempotencyConflict(exception)) { db.ChangeTracker.Clear(); return await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) ?? Conflict("The request was processed concurrently. Retry with the same key."); } catch (DbUpdateException) { return Conflict("The risk changed concurrently. Read it again and retry."); }
        return Results.Ok(new { risk.Id, version });
    }

    private static async Task<IResult> CreateMeasure(Guid itemId, Guid riskId, MeasureRequest request, HttpContext http, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        if (ValidateMeasure(request, false) is { } invalid) return invalid;
        var risk = await db.Risks.SingleOrDefaultAsync(x => x.Id == riskId && x.SiteId == access.Item!.SiteId && x.ObjectType == "task" && x.ObjectId == itemId, ct); if (risk is null) return Results.NotFound();
        var owner = await Person(risk.SiteId, request.OwnerPersonId, db, ct); if (owner is null) return Validation("ownerPersonId", "The owner must be an active Site member.");
        var hash = OperationalApiCommandEndpoints.Hash("measure.create", new { itemId, riskId, request });
        if (await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) is { } replay) return replay;
        var now = DateTimeOffset.UtcNow; var measure = RiskMitigation.FromMachine(Guid.NewGuid(), risk.Id, access.MachineId, now);
        db.RiskMitigations.Add(measure); db.RiskMitigationRevisions.Add(RiskMitigationRevision.FromMachine(Guid.NewGuid(), measure.Id, 1, request.Action!, owner.Value.Id, owner.Value.Name, request.Status!, request.DueDate, access.MachineId, now));
        OperationalApiCommandEndpoints.AddIdempotency(db, access.MachineId, http, hash, measure.Id, now);
        await OperationalApiActivity.Record(db, access.MachineId, risk.SiteId, "measure.created", "measure", measure.Id, itemId, new { revision = 1, status = request.Status }, http, now, null, ct);
        return await SaveCreated(db, http, access.MachineId, hash, measure.Id, $"/api/v1/work/items/{itemId}/risks/{riskId}/measures/{measure.Id}", new { measure.Id, version = 1 }, ct);
    }

    private static async Task<IResult> ReviseMeasure(Guid itemId, Guid riskId, Guid measureId, MeasureRequest request, HttpContext http, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        if (ValidateMeasure(request, true) is { } invalid) return invalid;
        var hash = OperationalApiCommandEndpoints.Hash("measure.revise", new { itemId, riskId, measureId, request });
        if (await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) is { } replay) return replay;
        var measure = await db.RiskMitigations.Include(x => x.Risk).Include(x => x.Revisions).SingleOrDefaultAsync(x => x.Id == measureId && x.RiskId == riskId && x.Risk.SiteId == access.Item!.SiteId && x.Risk.ObjectType == "task" && x.Risk.ObjectId == itemId, ct); if (measure is null) return Results.NotFound();
        var latest = measure.Revisions.Max(x => x.Version); if (latest != request.ExpectedVersion) return Conflict("The measure changed. Read it again and retry.");
        var owner = await Person(measure.Risk.SiteId, request.OwnerPersonId, db, ct); if (owner is null) return Validation("ownerPersonId", "The owner must be an active Site member.");
        var now = DateTimeOffset.UtcNow; var version = NumericBounds.NextVersion(latest);
        db.RiskMitigationRevisions.Add(RiskMitigationRevision.FromMachine(Guid.NewGuid(), measure.Id, version, request.Action!, owner.Value.Id, owner.Value.Name, request.Status!, request.DueDate, access.MachineId, now));
        OperationalApiCommandEndpoints.AddIdempotency(db, access.MachineId, http, hash, measure.Id, now);
        await OperationalApiActivity.Record(db, access.MachineId, measure.Risk.SiteId, "measure.updated", "measure", measure.Id, itemId, new { revision = version, status = request.Status, previousStatus = measure.Revisions.Single(x => x.Version == latest).Status }, http, now, null, ct);
        try { await db.SaveChangesAsync(ct); } catch (DbUpdateException exception) when (OperationalApiCommandEndpoints.IsIdempotencyConflict(exception)) { db.ChangeTracker.Clear(); return await OperationalApiCommandEndpoints.Replay(access.MachineId, hash, http, db, ct) ?? Conflict("The request was processed concurrently. Retry with the same key."); } catch (DbUpdateException) { return Conflict("The measure changed concurrently. Read it again and retry."); }
        return Results.Ok(new { measure.Id, version });
    }

    private static async Task<IResult> UpdatePlanningDocument(Guid itemId, Guid stepId,
        PlanningDocumentRequest request, HttpContext http, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        var links = request.Links ?? []; var events = request.TimelineEvents ?? []; var content = request.Content ?? "";
        if (ValidateDocument(content, events) is { } invalid) return invalid;
        if (links.Count > 30 || links.Any(x =>
            x is null || string.IsNullOrWhiteSpace(x.Label) || x.Label.Trim().Length > 240 ||
            !WorkLinkPolicy.TryNormalize(x.Url, out var normalized) || normalized is null))
            return Validation("links", "Provide at most 30 valid document links.");
        var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.WorkItemId == itemId && x.Status == "in_progress", ct);
        var step = run is null ? null : await db.WorkflowSteps.SingleOrDefaultAsync(x => x.Id == stepId && x.DefinitionId == run.DefinitionId, ct);
        if (run is null || step is null) return Results.NotFound();
        if (!ExpectedVersion(http, db.Entry(run).Property<uint>("xmin").CurrentValue)) return VersionProblem(http);
        if (events.Count > 0 && !step.HasTimeline || events.Any(x => run.TimelineStartedOn.HasValue && x.Date < run.TimelineStartedOn.Value)) return Validation("timelineEvents", "The timeline is not valid for this planning step.");
        var now = DateTimeOffset.UtcNow;
        var document = await db.WorkflowStepDocuments.SingleOrDefaultAsync(x => x.RunId == run.Id && x.StepId == stepId, ct);
        if (document is null) db.WorkflowStepDocuments.Add(new WorkflowStepDocument(Guid.NewGuid(), run.Id, stepId, content, now)); else document.Update(content, now);
        db.WorkflowStepLinks.RemoveRange(await db.WorkflowStepLinks.Where(x => x.RunId == run.Id && x.StepId == stepId).ToListAsync(ct));
        foreach (var link in links) { WorkLinkPolicy.TryNormalize(link.Url, out var url); db.WorkflowStepLinks.Add(new WorkflowStepLink(Guid.NewGuid(), run.Id, stepId, link.Label!.Trim(), url!, now)); }
        db.WorkflowTimelineEvents.RemoveRange(await db.WorkflowTimelineEvents.Where(x => x.RunId == run.Id && x.StepId == stepId).ToListAsync(ct));
        for (var i = 0; i < events.Count; i++) db.WorkflowTimelineEvents.Add(new WorkflowTimelineEvent(Guid.NewGuid(), run.Id, stepId, events[i].Date, events[i].Description!.Trim(), i));
        db.Entry(run).Property(x => x.CurrentStep).IsModified = true;
        await OperationalApiActivity.Record(db, access.MachineId, run.WorkItem.SiteId, "plan.updated", "plan", run.Id, itemId, new { changedFields = "documentation" }, http, now, null, ct);
        return await SaveRun(run, http, db, ct);
    }

    private static async Task<IResult> UpdateExecutionDocument(Guid itemId, Guid stepId,
        ExecutionDocumentRequest request, HttpContext http, FylkrenDbContext db, CancellationToken ct)
    {
        var access = await Access(itemId, http, db, ct); if (access.Error is not null) return access.Error;
        var events = request.TimelineEvents ?? []; var content = request.Content ?? "";
        if (ValidateDocument(content, events) is { } invalid) return invalid;
        var run = await db.ExecutionRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.WorkItemId == itemId && x.Status == "in_progress", ct);
        var step = run?.DefinitionId is null ? null : await db.WorkflowSteps.SingleOrDefaultAsync(x => x.Id == stepId && x.DefinitionId == run.DefinitionId, ct);
        if (run is null || step is null) return Results.NotFound();
        if (!ExpectedVersion(http, db.Entry(run).Property<uint>("xmin").CurrentValue)) return VersionProblem(http);
        if (events.Count > 0 && !step.HasTimeline || events.Any(x => run.TimelineStartedOn.HasValue && x.Date < run.TimelineStartedOn.Value)) return Validation("timelineEvents", "The timeline is not valid for this execution step.");
        var now = DateTimeOffset.UtcNow; var document = await db.ExecutionStepDocuments.SingleOrDefaultAsync(x => x.RunId == run.Id && x.StepId == stepId, ct);
        if (document is null) db.ExecutionStepDocuments.Add(new ExecutionStepDocument(Guid.NewGuid(), run.Id, stepId, content, now)); else document.Update(content, now);
        db.ExecutionTimelineEvents.RemoveRange(await db.ExecutionTimelineEvents.Where(x => x.RunId == run.Id && x.StepId == stepId).ToListAsync(ct));
        for (var i = 0; i < events.Count; i++) db.ExecutionTimelineEvents.Add(new ExecutionTimelineEvent(Guid.NewGuid(), run.Id, stepId, events[i].Date, events[i].Description!.Trim(), i));
        run.Advance(run.CurrentStep, now);
        var number = await db.WorkflowSteps.CountAsync(x => x.DefinitionId == step.DefinitionId && x.SortOrder < step.SortOrder, ct) + 1;
        await OperationalApiActivity.Record(db, access.MachineId, run.WorkItem.SiteId, "execution.updated", "execution", run.Id, itemId, new { changedFields = "documentation", stepNumber = number, stepName = step.Name }, http, now, null, ct);
        return await SaveRun(run, http, db, ct);
    }

    private static IResult? ValidateDecision(DecisionRequest value, bool revision)
    {
        if ((value.Title ?? "").Trim().Length is < 2 or > 200) return Validation("title", "Use 2–200 characters.");
        if ((value.Decision ?? "").Trim().Length is < 2 or > 10_000) return Validation("decision", "Use 2–10,000 characters.");
        if ((value.Rationale ?? "").Trim().Length is < 2 or > 10_000) return Validation("rationale", "Use 2–10,000 characters.");
        if (value.DecisionMakerIds is not { Count: > 0 and <= 20 }) return Validation("decisionMakerIds", "Select 1–20 human decision-makers.");
        if (revision && value.ExpectedRevision is null) return Validation("expectedRevision", "Provide the latest revision number."); return null;
    }
    private static IResult? ValidateRisk(RiskRequest value, bool revision)
    {
        if ((value.Title ?? "").Trim().Length is < 2 or > 200 || (value.Description ?? "").Trim().Length is < 2 or > 10_000) return Validation("risk", "Provide a valid title and description.");
        if (value.Probability is < 1 or > 5 || value.Impact is < 1 or > 5 || (value.ResidualProbability is null) != (value.ResidualImpact is null) || value.ResidualProbability is < 1 or > 5 || value.ResidualImpact is < 1 or > 5) return Validation("assessment", "Probability and impact must be 1–5; provide both residual values or neither.");
        if (!RiskStatuses.Contains(value.Status ?? "")) return Validation("status", "Machine clients can use identified, active, or mitigating. Acceptance and closure require a person.");
        if (revision && value.ExpectedVersion is null) return Validation("expectedVersion", "Provide the latest version."); return null;
    }
    private static IResult? ValidateMeasure(MeasureRequest value, bool revision)
    {
        if ((value.Action ?? "").Trim().Length is < 2 or > 4_000) return Validation("action", "Use 2–4,000 characters.");
        if (!MeasureStatuses.Contains(value.Status ?? "")) return Validation("status", "Machine clients can use planned or in_progress. Completion and cancellation require a person.");
        if (revision && value.ExpectedVersion is null) return Validation("expectedVersion", "Provide the latest version."); return null;
    }
    private static IResult? ValidateDocument(string content, IReadOnlyList<TimelineRequest> events)
    { if (content.Length > 20_000 || events.Count > 100 || events.Any(x => x is null || string.IsNullOrWhiteSpace(x.Description) || x.Description.Trim().Length > 1_000)) return Validation("content", "Check the text and timeline entries."); return null; }
    private static bool ExpectedVersion(HttpContext http, uint current)
    { var raw = http.Request.Headers.IfMatch.ToString().Trim(); return raw.Length >= 3 && raw[0] == '"' && raw[^1] == '"' && uint.TryParse(raw[1..^1], out var expected) && expected == current; }
    private static IResult VersionProblem(HttpContext http) => OperationalApiCommandEndpoints.Problem(http,
        string.IsNullOrWhiteSpace(http.Request.Headers.IfMatch) ? 428 : 409,
        string.IsNullOrWhiteSpace(http.Request.Headers.IfMatch) ? "if_match_required" : "version_conflict",
        "Use the ETag from the latest planning or execution read.");
    private static async Task<IResult> SaveRun(object run, HttpContext http, FylkrenDbContext db, CancellationToken ct)
    { try { await db.SaveChangesAsync(ct); } catch (DbUpdateConcurrencyException) { return OperationalApiCommandEndpoints.Problem(http, 409, "version_conflict", "The run changed. Read it again and retry."); } var version = (uint)db.Entry(run).Property("xmin").CurrentValue!; http.Response.Headers.ETag = $"\"{version}\""; return Results.Ok(new { version }); }
    private static async Task<AccessResult> Access(Guid itemId, HttpContext http, FylkrenDbContext db, CancellationToken ct)
    {
        if (!OperationalApiEndpoints.MachineId(http.User, out var machineId)) return new(machineId, null, Results.Unauthorized());
        var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId, ct);
        if (item is null || !await OperationalApiEndpoints.HasGrant(machineId, item.SiteId, item.AssignedUnitId, db, ct)) return new(machineId, null, Results.NotFound());
        var stage = await db.InformationLifecycles.AsNoTracking().Where(x => x.ResourceType == "work_item" && x.ResourceId == itemId).Select(x => x.Stage).SingleOrDefaultAsync(ct);
        if (stage is "closed" or "archived" || item.Status is "completed" or "cancelled" or "rejected" or "reassigned")
            return new(machineId, null, Conflict("Closed or archived work cannot be changed through the operational API."));
        return new(machineId, item, null);
    }
    private static async Task<List<(Guid Id, string Name)>?> People(Guid siteId, IReadOnlyList<Guid> ids, FylkrenDbContext db, CancellationToken ct)
    { var distinct = ids.Distinct().ToArray(); var values = await db.SiteMemberships.AsNoTracking().Where(x => x.SiteId == siteId && x.IsActive && x.Person.IsActive && distinct.Contains(x.PersonId)).Select(x => new { x.PersonId, x.Person.DisplayName }).ToListAsync(ct); return values.Count == distinct.Length ? values.Select(x => (x.PersonId, x.DisplayName)).ToList() : null; }
    private static async Task<(Guid Id, string Name)?> Person(Guid siteId, Guid id, FylkrenDbContext db, CancellationToken ct)
    { var values = await People(siteId, new[] { id }, db, ct); return values is { Count: 1 } ? values[0] : null; }
    private static async Task<IResult> SaveCreated(FylkrenDbContext db, HttpContext http, Guid machineId, string hash, Guid id, string location, object response, CancellationToken ct)
    { try { await db.SaveChangesAsync(ct); } catch (DbUpdateException exception) when (OperationalApiCommandEndpoints.IsIdempotencyConflict(exception)) { db.ChangeTracker.Clear(); return await OperationalApiCommandEndpoints.Replay(machineId, hash, http, db, ct) ?? Conflict("The request was processed concurrently. Retry with the same key."); } http.Response.Headers.Location = location; return Results.Json(response, statusCode: 201); }
    private static IResult Validation(string field, string message) => OperationalApiCommandEndpoints.Validation(field, message);
    private static IResult Conflict(string message) => Results.Conflict(new { error = message });
    private sealed record AccessResult(Guid MachineId, WorkItem? Item, IResult? Error);
}
