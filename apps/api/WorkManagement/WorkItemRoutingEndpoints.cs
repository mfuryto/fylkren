using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemRoutingEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/delegate", Delegate);
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/reassign", Reassign);
    }

    private static async Task<IResult> Delegate(Guid siteId, Guid itemId, DelegateRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && (x.SiteId == siteId || x.ParentWorkItem != null && x.ParentWorkItem.SiteId == siteId), ct);
        if (item is null) return Results.NotFound();
        if (item.SiteId == siteId && await IsOutgoingRequest(item.Id, siteId, db, ct)) return Results.Conflict(new { error = "En sendt anmodning behandles av mottakende site og er skrivebeskyttet hos avsender." });
        if (!await CanManageItem(item, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (await WorkItemDependencyEndpoints.IsBlocked(item.Id, db, ct)) return Results.Conflict(new { error = "Oppdraget kan ikke fordeles før alle oppdrag det avhenger av er fullført." });
        if (item.Status is not ("assigned" or "in_progress" or "planning" or "planning_approval" or "execution")) return Results.Conflict(new { error = "Oppgaven kan ikke fordeles videre i denne statusen." });
        if (await db.WorkItems.AnyAsync(x => x.ParentWorkItemId == item.Id && x.Status != "completed" && x.Status != "reassigned" && x.Status != "cancelled" && x.Status != "rejected", ct)) return Results.Conflict(new { error = "Oppdraget er allerede fordelt og venter på rapport fra undernivå." });
        if (!await IsDirectChild(siteId, item.AssignedUnitId, request.AssignedUnitId, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["assignedUnitId"] = ["Velg en aktiv direkte underenhet."] });
        var instruction = (request.Instruction ?? "").Trim();
        if (instruction.Length is < 2 or > 10000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["instruction"] = ["Oppdragsteksten må være mellom 2 og 10 000 tegn."] });
        var target = await db.OrganizationUnits.Include(x => x.Site).SingleAsync(x => x.Id == request.AssignedUnitId, ct);
        var now = DateTimeOffset.UtcNow;
        var previousStatus = item.Status;
        WorkItem child;
        if (target.SiteId == siteId)
        {
            var previousDeliveries = await db.WorkItems.AsNoTracking()
                .Where(x => x.ParentWorkItemId == item.Id && x.Status == "completed" && x.FinalReport != null && x.FinalReportApprovedAt != null)
                .OrderBy(x => x.FinalReportApprovedAt)
                .Select(x => new { UnitName = x.AssignedUnit == null ? "tidligere mottaker" : x.AssignedUnit.Name, x.FinalReport })
                .ToListAsync(ct);
            var requestBasis = BuildInternalDelegationBasis(item, previousDeliveries.Select(x => (x.UnitName, x.FinalReport!)));
            child = WorkItem.CreateDelegated(Guid.NewGuid(), item, personId, target.Id, target.Name, instruction, now, requestBasis);
        }
        else
        {
            var source = await db.Sites.SingleAsync(x => x.Id == siteId, ct);
            var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
            var sourceTypeName = item.SourceTypeId is Guid sourceTypeId ? await db.WorkItemLookups.Where(x => x.Id == sourceTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : item.SourceTypeNameSnapshot;
            var workItemTypeName = item.WorkItemTypeId is Guid workItemTypeId ? await db.WorkItemTypes.Where(x => x.Id == workItemTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : item.WorkItemTypeNameSnapshot;
            var originalSenderName = item.SenderId is Guid senderId ? await db.WorkItemLookups.Where(x => x.Id == senderId).Select(x => x.Name).SingleOrDefaultAsync(ct) : item.SenderNameSnapshot;
            child = WorkItem.CreateTransferred(Guid.NewGuid(), item, target.SiteId, personId, source.Name, actor.DisplayName, sourceTypeName, workItemTypeName, originalSenderName, await db.WorkflowRuns.AnyAsync(x => x.WorkItemId == item.Id, ct) ? item.Id : item.UpstreamPlanWorkItemId, instruction, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), target.SiteId, personId, "work-item.received-from-parent-site", "work-item", child.Id, now));
        }
        db.WorkItems.Add(child);
        item.TransitionWithinLevel("in_progress", $"Behandlingen på dette nivået ble avsluttet og oppdraget fordelt videre til {target.Name}.", now);
        if (previousStatus is "planning" or "planning_approval")
        {
            var planningRuns = await db.WorkflowRuns.Where(x => x.WorkItemId == item.Id && x.Status != "approved" && x.Status != "rejected" && x.Status != "cancelled").ToListAsync(ct);
            foreach (var run in planningRuns) run.Cancel();
        }
        if (previousStatus == "execution")
        {
            var executionRuns = await db.ExecutionRuns.Where(x => x.WorkItemId == item.Id && x.Status != "submitted" && x.Status != "cancelled").ToListAsync(ct);
            foreach (var run in executionRuns) run.Cancel(now);
        }
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, target.SiteId == siteId ? previousStatus is "planning" or "planning_approval" or "execution" ? "work-item.processing-delegated" : "work-item.delegated" : "work-item.transferred-to-child-site", "work-item", child.Id, now));
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/sites/{siteId}/items/{child.Id}", new { child.Id });
    }

    private static async Task<IResult> Reassign(Guid siteId, Guid itemId, ReassignRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && (x.SiteId == siteId || x.ParentWorkItem != null && x.ParentWorkItem.SiteId == siteId), ct);
        if (item?.ParentWorkItemId is not Guid parentId || item.Status is "completed" or "cancelled" or "reassigned") return Results.Conflict(new { error = "Bare aktive deloppdrag kan omfordeles. Fullførte oppdrag er avsluttet." });
        var parent = await db.WorkItems.SingleAsync(x => x.Id == parentId, ct);
        if (item.SiteId != siteId && await IsOutgoingRequest(parent.Id, siteId, db, ct)) return Results.Conflict(new { error = "Mottakers interne anmodningsbehandling kan ikke omfordeles av avsender." });
        if (!await CanManageItem(parent, personId, db, ct)) return Results.Problem(statusCode: 403);
        if (await WorkItemDependencyEndpoints.IsBlocked(item.Id, db, ct)) return Results.Conflict(new { error = "Et blokkert deloppdrag kan ikke omfordeles. Fjern avhengigheten eller fullfør forgjengerne først." });
        if (!await IsDirectChild(siteId, parent.AssignedUnitId, request.AssignedUnitId, db, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["assignedUnitId"] = ["Velg en aktiv direkte underenhet på dette arbeidsnivået."] });
        var target = await db.OrganizationUnits.Include(x => x.Site).SingleAsync(x => x.Id == request.AssignedUnitId, ct);
        var now = DateTimeOffset.UtcNow;
        WorkItem replacement;
        if (target.SiteId == parent.SiteId)
        {
            replacement = WorkItem.CreateDelegated(Guid.NewGuid(), parent, personId, target.Id, target.Name, item.Description, now);
        }
        else
        {
            var source = await db.Sites.SingleAsync(x => x.Id == parent.SiteId, ct);
            var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
            var sourceTypeName = parent.SourceTypeId is Guid sourceTypeId ? await db.WorkItemLookups.Where(x => x.Id == sourceTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : parent.SourceTypeNameSnapshot;
            var workItemTypeName = parent.WorkItemTypeId is Guid workItemTypeId ? await db.WorkItemTypes.Where(x => x.Id == workItemTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : parent.WorkItemTypeNameSnapshot;
            var senderName = parent.SenderId is Guid senderId ? await db.WorkItemLookups.Where(x => x.Id == senderId).Select(x => x.Name).SingleOrDefaultAsync(ct) : parent.SenderNameSnapshot;
            replacement = WorkItem.CreateTransferred(Guid.NewGuid(), parent, target.SiteId, personId, source.Name, actor.DisplayName, sourceTypeName, workItemTypeName, senderName, await db.WorkflowRuns.AnyAsync(x => x.WorkItemId == parent.Id, ct) ? parent.Id : parent.UpstreamPlanWorkItemId, item.Description, now);
        }
        if (item.SiteId == target.SiteId && item.FinalReport is not null) replacement.CarryForwardFinalReport(item, now);
        item.TransitionWithinLevel("reassigned", $"Omfordelt til {target.Name}.", now);
        db.WorkItems.Add(replacement);
        var planningRuns = await db.WorkflowRuns.Where(x => x.WorkItemId == item.Id && x.Status != "approved" && x.Status != "rejected" && x.Status != "cancelled").ToListAsync(ct);
        foreach (var run in planningRuns) run.Cancel();
        var executionRuns = await db.ExecutionRuns.Where(x => x.WorkItemId == item.Id && x.Status != "submitted" && x.Status != "cancelled").ToListAsync(ct);
        foreach (var run in executionRuns) run.Cancel(now);
        var ancestor = parent;
        var visited = new HashSet<Guid>();
        while (visited.Add(ancestor.Id))
        {
            if (ancestor.Status is "completed" or "in_review" || ancestor.FinalReportApprovedAt is not null) ancestor.ReopenAfterReassignment(now);
            if (ancestor.ParentWorkItemId is not Guid ancestorParentId) break;
            ancestor = await db.WorkItems.SingleAsync(x => x.Id == ancestorParentId, ct);
        }
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), item.SiteId, personId, "work-item.reassigned", "work-item", item.Id, now));
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), replacement.SiteId, personId, replacement.SiteId == parent.SiteId ? "work-item.reassignment-created" : "work-item.received-from-parent-site", "work-item", replacement.Id, now));
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/sites/{siteId}/items/{replacement.Id}", new { replacement.Id });
    }
}
