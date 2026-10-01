using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.DomainEvents;
using Fylkren.Api.Federation;
using Fylkren.Api.Licensing;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class PrimaryWorkItemCreationEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPost("/sites/{siteId:guid}/items", async (Guid siteId, CreateRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, LicenseService license, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId) || (request.AssignedUnitId is Guid sourceUnitId ? !await db.OrganizationUnits.AnyAsync(x => x.Id == sourceUnitId && x.SiteId == siteId && x.IsActive, ct) || !await LeadsUnit(siteId, sourceUnitId, personId, db, ct) : !await CanCreateAtSiteRoot(siteId, personId, db, ct))) return Results.Problem(statusCode: 403);
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
            var title = (request.Title ?? "").Trim(); var description = (request.Description ?? "").Trim(); var recommendation = string.IsNullOrWhiteSpace(request.Recommendation) ? null : request.Recommendation.Trim();
            if (title.Length is < 2 or > 200 || description.Length > 10000 || recommendation is { Length: > 4000 }) return Results.ValidationProblem(new Dictionary<string, string[]> { ["request"] = ["Check the title, description, and recommendation."] });
            if (!WorkLinkPolicy.TryNormalize(request.ReferenceUrl, out var referenceUrl)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["referenceUrl"] = ["The link must use https, http, file, or smb and cannot contain credentials."] });
            WorkItemType? selectedType = null;
            if (request.WorkItemTypeId is Guid typeId)
            {
                selectedType = await db.WorkItemTypes.SingleOrDefaultAsync(x => x.Id == typeId && x.SiteId == siteId && x.IsActive, ct);
                if (selectedType is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["workItemTypeId"] = ["Select an active task type in the site."] });
            }
            var isRequest = selectedType?.IsSystemManaged == true;
            Site? requestRecipient = null; FederationRemoteSite? remoteRecipient = null;
            OrganizationUnit? internalRecipient = null;
            if (isRequest)
            {
                if (request.TargetSiteId is null && request.TargetUnitId is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["recipient"] = ["Select a receiving site or internal work level."] });
                if (request.TargetSiteId is not null && request.TargetUnitId is not null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["recipient"] = ["Select only one recipient."] });
                if (request.TargetUnitId is Guid targetUnitId)
                {
                    if (remoteTarget) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetUnitId"] = ["Federated requests can only be sent to a top-level site."] });
                    if (request.AssignedUnitId is not Guid fromUnitId) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetUnitId"] = ["Internal requests must be sent from a subordinate level."] });
                    internalRecipient = await db.OrganizationUnits.SingleOrDefaultAsync(x => x.Id == targetUnitId && x.SiteId == siteId && x.IsActive && !x.IsSiteRoot && !x.IsSiteLeadership && x.Id != fromUnitId, ct);
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
                        requestRecipient = await db.Sites.SingleOrDefaultAsync(x => x.Id == targetSiteId && eligibleSiteIds.Contains(x.Id), ct);
                        if (requestRecipient is null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["targetSiteId"] = ["Select another active site that is not subordinate to the sender's site."] });
                    }
                }
            }
            else if (request.TargetSiteId is not null || request.TargetUnitId is not null) return Results.ValidationProblem(new Dictionary<string, string[]> { ["recipient"] = ["A recipient can only be selected for the Request type."] });
            if (request.SourceTypeId is Guid sourceId && !await db.WorkItemLookups.AnyAsync(x => x.Id == sourceId && x.SiteId == siteId && x.Kind == "source-type" && x.IsActive, ct) || request.SenderId is Guid senderId && !await db.WorkItemLookups.AnyAsync(x => x.Id == senderId && x.SiteId == siteId && x.Kind == "sender" && x.IsActive, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { { "lookup", ["Select an active source type and sender in the site."] } });
            var sourceTypeName = request.SourceTypeId is Guid requestSourceId ? await db.WorkItemLookups.Where(x => x.Id == requestSourceId).Select(x => x.Name).SingleOrDefaultAsync(ct) : null;
            var senderName = request.SenderId is Guid requestSenderId ? await db.WorkItemLookups.Where(x => x.Id == requestSenderId).Select(x => x.Name).SingleOrDefaultAsync(ct) : null;
            var now = DateTimeOffset.UtcNow; var item = new WorkItem(Guid.NewGuid(), siteId, personId, title, description, referenceUrl, "normal", request.DueAt, now, workItemTypeId: request.WorkItemTypeId, sourceTypeId: request.SourceTypeId, senderId: request.SenderId, recommendation: recommendation, sourceTypeNameSnapshot: sourceTypeName, senderNameSnapshot: senderName); db.WorkItems.Add(item);
            if (request.AssignedUnitId is Guid assignedUnitId) item.RegisterAtUnit(assignedUnitId, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, isRequest ? "work-item.request-sent" : "work-item.registered", "work-item", item.Id, now));
            DomainEventRecorder.Record(db, "task.created", siteId, personId, "task", item.Id, new { item.Id, item.Title, status = item.Status }, now);
            if (requestRecipient is not null)
            {
                var sourceSite = await db.Sites.SingleAsync(x => x.Id == siteId, ct);
                var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
                var received = WorkItem.CreateTransferred(Guid.NewGuid(), item, requestRecipient.Id, personId, sourceSite.Name, actor.DisplayName, sourceTypeName, "Request", senderName, null, description, now);
                db.WorkItems.Add(received);
                item.TransitionWithinLevel("in_progress", $"The request has been sent to {requestRecipient.Name} and is awaiting processing and reporting.", now);
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), requestRecipient.Id, personId, "work-item.received-from-parent-site", "work-item", received.Id, now));
            }
            else if (remoteRecipient is not null)
            {
                var outbound = await FederationOutboundWorkQueue.EnqueueAssignmentAsync(item,
                    remoteRecipient.InstanceId, remoteRecipient.SiteId, localInstanceId, db, ct);
                if (outbound is null) return Results.Conflict(new { error = "federation_outbound_not_authorized" });
                item.TransitionWithinLevel("in_progress", $"The request has been queued for delivery to {remoteRecipient.Name}.", now);
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
                    "work-item.federated-request-queued", "work-item", item.Id, now));
            }
            else if (internalRecipient is not null)
            {
                var sourceSite = await db.Sites.SingleAsync(x => x.Id == siteId, ct); var actor = await db.People.SingleAsync(x => x.Id == personId, ct);
                var received = WorkItem.CreateInternalRequest(Guid.NewGuid(), item, personId, internalRecipient.Id, sourceSite.Name, actor.DisplayName, sourceTypeName, senderName, description, now, description);
                db.WorkItems.Add(received); item.TransitionWithinLevel("in_progress", $"The request has been sent to {internalRecipient.Name} and is awaiting processing and reporting.", now);
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.internal-request-received", "work-item", received.Id, now));
            }
            await db.SaveChangesAsync(ct); return Results.Created($"/api/work/sites/{siteId}/items/{item.Id}", new { item.Id });
        });
    }
}
