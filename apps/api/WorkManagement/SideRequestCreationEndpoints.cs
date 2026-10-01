using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class SideRequestCreationEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/request", async (Guid siteId, Guid itemId, CreateSideRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, LicenseService license, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
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
            var source = await db.WorkItems.Include(x => x.WorkItemType).SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
            if (source is null) return Results.NotFound();
            if (!await CanManageItem(source, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (await WorkItemDependencyEndpoints.IsBlocked(source.Id, db, ct)) return Results.Conflict(new { error = "The task cannot send requests until all tasks it depends on are completed." });
            if (source.Status is "registered" or "on_hold" or "planning_approved" or "in_review" or "completed" or "rejected" or "cancelled" or "reassigned" or "request_cancelled" || await IsOutgoingRequest(source.Id, siteId, db, ct)) return Results.Conflict(new { error = "A request can only be sent after manager review, and not while an approved plan awaits initiation, the task is under review, or the task is closed." });
            var title = (request.Title ?? "").Trim(); var description = (request.Description ?? "").Trim();
            if (title.Length is < 2 or > 200 || description.Length is < 2 or > 10000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["The title and task text are required."] });
            if (request.TargetSiteId is null && request.TargetUnitId is null || request.TargetSiteId is not null && request.TargetUnitId is not null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["recipient"] = ["Select one recipient."] });
            Site? recipient = null; FederationRemoteSite? remoteRecipient = null;
            OrganizationUnit? internalRecipient = null;
            if (request.TargetUnitId is Guid targetUnitId)
            {
                if (remoteTarget) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetUnitId"] = ["Federated requests can only be sent to a top-level site."] });
                if (source.AssignedUnitId is not Guid sourceUnitId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetUnitId"] = ["An internal request must be sent from a subordinate level."] });
                internalRecipient = await db.OrganizationUnits.SingleOrDefaultAsync(x => x.Id == targetUnitId && x.SiteId == siteId && x.IsActive && !x.IsSiteRoot && !x.IsSiteLeadership && x.Id != sourceUnitId, ct);
                if (internalRecipient is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetUnitId"] = ["Select another active work level in the same site."] });
            }
            else
            {
                var targetSiteId = request.TargetSiteId!.Value;
                if (remoteTarget)
                {
                    var peerInstanceId = request.TargetInstanceId!.Value;
                    if (!await FederationOutboundWorkQueue.AuthorizedAsync(siteId, peerInstanceId, targetSiteId, db, ct))
                        return Results.Conflict(new { error = "federation_outbound_not_authorized" });
                    remoteRecipient = await db.FederationRemoteSites.SingleAsync(x =>
                        x.InstanceId == peerInstanceId && x.SiteId == targetSiteId, ct);
                }
                else
                {
                    var eligibleSiteIds = await RequestRecipientPolicy.EligibleSiteIds(siteId, db, ct);
                    recipient = await db.Sites.SingleOrDefaultAsync(x => x.Id == targetSiteId && eligibleSiteIds.Contains(x.Id), ct);
                    if (recipient is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetSiteId"] = ["Select another active site that is not subordinate to the sender's site."] });
                }
            }
            var requestType = await db.WorkItemTypes.SingleAsync(x => x.SiteId == siteId && x.IsSystemManaged, ct);
            var now = DateTimeOffset.UtcNow;
            var sourceSite = await db.Sites.SingleAsync(x => x.Id == siteId, ct);
            var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
            var sourceTypeName = source.SourceTypeId is Guid sourceTypeId ? await db.WorkItemLookups.Where(x => x.Id == sourceTypeId).Select(x => x.Name).SingleOrDefaultAsync(ct) : source.SourceTypeNameSnapshot;
            var senderName = source.SenderId is Guid senderId ? await db.WorkItemLookups.Where(x => x.Id == senderId).Select(x => x.Name).SingleOrDefaultAsync(ct) : source.SenderNameSnapshot;
            var approvedPlan = await db.WorkflowRuns.Include(x => x.WorkItem)
                .Where(x => x.WorkItemId == source.Id && x.Status == "approved")
                .OrderByDescending(x => x.StartedAt)
                .FirstOrDefaultAsync(ct);
            var requestBasis = approvedPlan is null
                ? $"# Task basis\n\n## Primary task description\n{source.Description}" + (string.IsNullOrWhiteSpace(source.ReferenceUrl) ? "" : $"\n\nHoveddokument: {source.ReferenceUrl}")
                : await PlanningApprovalService.BuildRequestBasis(approvedPlan, db, ct);
            var tracking = new WorkItem(Guid.NewGuid(), siteId, personId, title, description,
                source.ReferenceUrl, source.Priority, source.DueAt, now, source.Id, requestType.Id,
                source.SourceTypeId, source.SenderId, sourceTypeNameSnapshot: sourceTypeName,
                senderNameSnapshot: senderName, requestBasisSnapshot: requestBasis);
            if (source.AssignedUnitId is Guid trackingUnitId) tracking.AssignToUnit(trackingUnitId, null, now);
            var recipientName = internalRecipient?.Name ?? recipient?.Name ?? remoteRecipient!.Name;
            tracking.TransitionWithinLevel("in_progress", remoteRecipient is null
                ? $"The request has been sent to {recipientName} and is awaiting processing and a response."
                : $"The request has been queued for delivery to {recipientName}.", now);
            db.WorkItems.Add(tracking);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.request-sent-from-level", "work-item", tracking.Id, now));
            if (remoteRecipient is not null)
            {
                var outbound = await FederationOutboundWorkQueue.EnqueueAssignmentAsync(tracking,
                    remoteRecipient.InstanceId, remoteRecipient.SiteId, localInstanceId, db, ct);
                if (outbound is null) return Results.Conflict(new { error = "federation_outbound_not_authorized" });
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
                    "work-item.federated-request-queued", "work-item", tracking.Id, now));
            }
            else
            {
                var received = internalRecipient is null
                    ? WorkItem.CreateTransferred(Guid.NewGuid(), tracking, recipient!.Id, personId, sourceSite.Name, actor.DisplayName, sourceTypeName, "Request", senderName, null, description, now, requestBasis)
                    : WorkItem.CreateInternalRequest(Guid.NewGuid(), tracking, personId, internalRecipient.Id, sourceSite.Name, actor.DisplayName, sourceTypeName, senderName, description, now, requestBasis);
                db.WorkItems.Add(received);
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), received.SiteId, personId, internalRecipient is null ? "work-item.request-received" : "work-item.internal-request-received", "work-item", received.Id, now));
            }
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/work/sites/{siteId}/items/{tracking.Id}", new { tracking.Id });
        });
    }
}
