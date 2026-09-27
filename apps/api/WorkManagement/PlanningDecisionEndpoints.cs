using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningDecisionEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/planning/{runId:guid}/decision", async (Guid runId, Decision request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, LicenseService license, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && (x.Status == "awaiting_approval" || x.Status == "approved" && x.WorkItem.Status == "planning_approved"), ct);
            if (run is null) return Results.NotFound();
            if (!await WorkLevelAuthorization.LeadsLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403, title: "Lederrettighet kreves på planens arbeidsnivå.");
            if (run.Status == "approved")
            {
                if (request.Action == "release")
                {
                    if (await WorkItemDependencyEndpoints.IsBlocked(run.WorkItemId, db, ct)) return Results.Conflict(new { error = "Oppdraget kan ikke iverksettes før alle avhengige oppdrag er fullført." });
                    var hasRemoteRequests = await db.WorkflowPlanRequests.AsNoTracking()
                        .AnyAsync(x => x.RunId == runId && x.TargetInstanceId != null, ct);
                    if (hasRemoteRequests && !await FederationRoutingPolicy.IsEnabledAsync(db, ct))
                        return Results.Conflict(new { error = "federated_recipient_not_routable" });
                    if (hasRemoteRequests && !await license.Has(db, FeatureCatalog.InstanceFederation, ct))
                        return Results.Problem(statusCode: StatusCodes.Status403Forbidden,
                            title: "Enterprise-rettighet kreves for denne funksjonen.",
                            extensions: new Dictionary<string, object?> {
                                ["code"] = "enterprise_entitlement_required",
                                ["feature"] = FeatureCatalog.InstanceFederation });
                    var localInstanceId = await db.InstanceIdentities.AsNoTracking()
                        .Where(x => x.Key == 1).Select(x => x.InstanceId).SingleAsync(ct);
                    if (await PlanningApprovalService.Release(run, personId,
                            localInstanceId, db, ct) is { } releaseError)
                        return Results.Conflict(new { error = releaseError });
                    return Results.NoContent();
                }
                if (request.Action != "hold") return Results.Conflict(new { error = "Den godkjente planen kan bare avventes eller iverksettes." });
            }
            if (request.Action == "approve")
            {
                await PlanningApprovalService.Approve(run, personId, db, ct);
                return Results.NoContent();
            }
            if (string.IsNullOrWhiteSpace(request.Note) || request.Note.Trim().Length > 2000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["note"] = ["Begrunnelse er påkrevd og kan være maksimalt 2000 tegn."] });
            var now = DateTimeOffset.UtcNow;
            if (request.Action == "replan") { run.Return(); run.WorkItem.TransitionWithinLevel("planning", request.Note, now); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.replanning-requested", "workflow-run", run.Id, now)); }
            else if (request.Action == "hold") { run.WorkItem.TransitionWithinLevel("on_hold", request.Note, now); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.put-on-hold", "workflow-run", run.Id, now)); }
            else if (request.Action == "reject") { run.Reject(); run.WorkItem.TransitionWithinLevel("rejected", request.Note, now); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), run.WorkItem.SiteId, personId, "workflow.rejected", "workflow-run", run.Id, now)); }
            else return Results.ValidationProblem(new Dictionary<string, string[]> { ["action"] = ["Ugyldig beslutning."] });
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record Decision(string Action, string? Note);
}
