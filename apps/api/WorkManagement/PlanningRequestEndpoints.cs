using System.Security.Claims;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkflowEndpoints;

namespace Fylkren.Api.WorkManagement;

internal static class PlanningRequestEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/planning/{runId:guid}/requests", async (Guid runId, PlannedRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, LicenseService license, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var run = await db.WorkflowRuns.Include(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == runId && x.ClaimedByPersonId == personId && x.Status == "in_progress", ct);
            if (run is null || !await OrganizationAuthorization.CanPlanAtLevel(run.WorkItem.SiteId, run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            var localInstanceId = await db.InstanceIdentities.AsNoTracking().Where(x => x.Key == 1)
                .Select(x => x.InstanceId).SingleAsync(ct);
            var remoteTarget = request.TargetInstanceId is Guid targetInstanceId && targetInstanceId != localInstanceId;
            if (remoteTarget && !await FederationRoutingPolicy.IsEnabledAsync(db, ct))
                return Results.Conflict(new { error = "federated_recipient_not_routable" });
            if (remoteTarget && !await license.Has(db, FeatureCatalog.InstanceFederation, ct))
                return Results.Problem(statusCode: StatusCodes.Status403Forbidden,
                    title: "An Enterprise entitlement is required for this feature.",
                    extensions: new Dictionary<string, object?> {
                        ["code"] = "enterprise_entitlement_required",
                        ["feature"] = FeatureCatalog.InstanceFederation });
            var instruction = (request.Instruction ?? "").Trim();
            var validStep = await db.WorkflowSteps.AnyAsync(x => x.Id == request.StepId && x.DefinitionId == run.DefinitionId && x.AllowsTaskAllocation, ct);
            if (!validStep || instruction.Length is < 2 or > 2000)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["Select another active site that is not subordinate to the sender's site, and enter the request."] });
            WorkflowPlanRequest plannedRequest;
            if (remoteTarget)
            {
                var peerInstanceId = request.TargetInstanceId!.Value;
                if (!await FederationOutboundWorkQueue.AuthorizedAsync(run.WorkItem.SiteId,
                        peerInstanceId, request.TargetSiteId, db, ct))
                    return Results.Conflict(new { error = "federation_outbound_not_authorized" });
                if (await db.WorkflowPlanRequests.AnyAsync(x => x.RunId == runId &&
                        x.StepId == request.StepId && x.TargetInstanceId == peerInstanceId &&
                        x.RemoteSiteId == request.TargetSiteId, ct))
                    return Results.Conflict(new { error = "The site has already been added to this planning step." });
                var remote = await db.FederationRemoteSites.SingleAsync(x =>
                    x.InstanceId == peerInstanceId && x.SiteId == request.TargetSiteId, ct);
                plannedRequest = new WorkflowPlanRequest(Guid.NewGuid(), runId, request.StepId,
                    peerInstanceId, remote.SiteId, remote.Name, instruction);
            }
            else
            {
                var eligibleSiteIds = await RequestRecipientPolicy.EligibleSiteIds(run.WorkItem.SiteId, db, ct);
                if (!eligibleSiteIds.Contains(request.TargetSiteId))
                    return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["Select another active site that is not subordinate to the sender's site, and enter the request."] });
                if (await db.WorkflowPlanRequests.AnyAsync(x => x.RunId == runId &&
                        x.StepId == request.StepId && x.TargetSiteId == request.TargetSiteId, ct))
                    return Results.Conflict(new { error = "The site has already been added to this planning step." });
                plannedRequest = new WorkflowPlanRequest(Guid.NewGuid(), runId, request.StepId,
                    request.TargetSiteId, instruction);
            }
            db.WorkflowPlanRequests.Add(plannedRequest);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/workflows/planning/{runId}/requests/{plannedRequest.Id}", new { plannedRequest.Id });
        });

        group.MapDelete("/planning/{runId:guid}/requests/{requestId:guid}", async (Guid runId, Guid requestId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Pid(user, out var personId)) return Results.Problem(statusCode: 403);
            var request = await db.WorkflowPlanRequests.Include(x => x.Run).ThenInclude(x => x.WorkItem).SingleOrDefaultAsync(x => x.Id == requestId && x.RunId == runId && x.Run.ClaimedByPersonId == personId && x.Run.Status == "in_progress", ct);
            if (request is null || !await OrganizationAuthorization.CanPlanAtLevel(request.Run.WorkItem.SiteId, request.Run.WorkItem.AssignedUnitId, personId, db, ct)) return Results.Problem(statusCode: 403);
            db.WorkflowPlanRequests.Remove(request);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record PlannedRequest(Guid StepId, Guid TargetSiteId, string Instruction, Guid? TargetInstanceId = null);
}
