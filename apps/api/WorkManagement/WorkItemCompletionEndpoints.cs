using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.Approvals;
using Fylkren.Api.Federation;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.WorkManagement.WorkItemPolicy;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemCompletionEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        group.MapPut("/sites/{siteId:guid}/items/{itemId:guid}/final-report", async (Guid siteId, Guid itemId, FinalReportRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
            if (item is null) return Results.NotFound();
            if (await IsOutgoingRequest(item.Id, siteId, db, ct)) return Results.Conflict(new { error = "En sendt anmodning behandles av mottakende site og er skrivebeskyttet hos avsender." });
            if (!await CanManageItem(item, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (item.Status != "in_review") return Results.Conflict(new { error = "Sluttrapport kan skrives når oppdraget er sendt til kontroll." });
            var report = request.Content?.Trim() ?? string.Empty;
            var classification = string.IsNullOrWhiteSpace(request.Classification) ? null : request.Classification.Trim().ToUpperInvariant();
            if (report.Length is < 2 or > 20000 || classification is { Length: > 20 }) return Results.ValidationProblem(new Dictionary<string, string[]> { ["content"] = ["Kontroller sluttrapporten og klassifiseringen."] });
            if (classification is not null && (!await db.ClassificationSettings.AnyAsync(x => x.Id == ClassificationEndpoints.SettingsId && x.IsEnabled, ct) || !await db.ClassificationDefinitions.AnyAsync(x => x.IsActive && x.Abbreviation == classification, ct))) return Results.ValidationProblem(new Dictionary<string, string[]> { ["classification"] = ["Velg en aktiv klassifisering."] });
            var now = DateTimeOffset.UtcNow;
            item.UpdateFinalReport(report, classification, personId, now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.final-report-updated", "work-item", item.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/final-report/approve", async (Guid siteId, Guid itemId, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var item = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
            if (item is null) return Results.NotFound();
            if (await IsOutgoingRequest(item.Id, siteId, db, ct)) return Results.Conflict(new { error = "En sendt anmodning behandles av mottakende site og er skrivebeskyttet hos avsender." });
            if (!await CanManageItem(item, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (item.Status != "in_review" || string.IsNullOrWhiteSpace(item.FinalReport)) return Results.Conflict(new { error = "Sluttrapporten må være skrevet og oppdraget må være til kontroll." });
            if (item.FinalReportApprovedAt is not null) return Results.Conflict(new { error = "Denne versjonen av sluttrapporten er allerede godkjent. Endringer må lagres som en ny arbeidsversjon før den kan godkjennes på nytt." });
            var now = DateTimeOffset.UtcNow;
            item.ApproveFinalReport(personId, now);
            await FormalApprovalService.Approve(db, siteId, "final_report", item.Id, item.Id, $"Sluttrapport for {item.Title}", new
            {
                task = new { item.Id, item.Title, item.Description, item.AssignedUnitId, item.CreatedAt, item.DueAt },
                report = new { content = item.FinalReport, classification = item.FinalReportClassification, writtenByPersonId = item.FinalReportWrittenByPersonId, writtenAt = item.FinalReportUpdatedAt }
            }, personId, now, ct);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.final-report-approved", "work-item", item.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
        group.MapPost("/sites/{siteId:guid}/items/{itemId:guid}/cancel", async (Guid siteId, Guid itemId, CancelRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            var note = request.DecisionNote?.Trim() ?? string.Empty;
            if (note.Length is < 2 or > 2000) return Results.ValidationProblem(new Dictionary<string, string[]> { ["decisionNote"] = ["Begrunnelse må være mellom 2 og 2000 tegn."] });
            var root = await db.WorkItems.SingleOrDefaultAsync(x => x.Id == itemId && x.SiteId == siteId, ct);
            if (root is null) return Results.NotFound();
            var outgoingRequest = await IsOutgoingRequest(root.Id, siteId, db, ct);
            if (outgoingRequest ? !await CanManageItem(root, personId, db, ct) : !await IsDedicatedTopLeader(siteId, personId, db, ct)) return Results.Problem(statusCode: 403);
            if (outgoingRequest)
            {
                var requestNow = DateTimeOffset.UtcNow;
                var federated = await FederationOperationalReturnQueue.QueueCancellationIfFederatedAsync(
                    root, personId, note, requestNow, db, ct);
                if (federated.Handled)
                {
                    if (federated.Error is not null)
                        return Results.Conflict(new { error = federated.Error });
                    await db.SaveChangesAsync(ct);
                    return Results.Accepted(value: new { affected = 1, awaitingRemoteReceipt = true });
                }
                root.TransitionWithinLevel("cancelled", note, requestNow);
                var receiver = await db.WorkItems.SingleOrDefaultAsync(x => x.ParentWorkItemId == root.Id && x.SenderSiteName != null && (x.SiteId != root.SiteId || x.AssignedUnitId != root.AssignedUnitId), ct);
                if (receiver is null) return Results.Conflict(new { error = "Mottakersiden av anmodningen finnes ikke lenger." });
                receiver.TransitionWithinLevel("request_cancelled", $"Anmodningen er trukket av {await db.Sites.Where(x => x.Id == siteId).Select(x => x.Name).SingleAsync(ct)}: {note}", requestNow);
                db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item.request-cancelled", "work-item", root.Id, requestNow)); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), receiver.SiteId, personId, "work-item.request-cancelled-by-sender", "work-item", receiver.Id, requestNow)); await db.SaveChangesAsync(ct); return Results.Ok(new { affected = 2 });
            }
            if (root.ParentWorkItemId is not null) return Results.Conflict(new { error = "Kansellering av hele kjeden må utføres på hovedoppdraget." });
            if (root.Status is "completed" or "cancelled") return Results.Conflict(new { error = "Et avsluttet hovedoppdrag kan ikke kanselleres." });
            var items = await WorkItemDescendantLoader.Load(root, db, ct);
            var affectedIds = items.Select(x => x.Id).ToHashSet();
            var now = DateTimeOffset.UtcNow;
            foreach (var item in items) item.TransitionWithinLevel("cancelled", note, now);
            var runs = await db.WorkflowRuns.Where(x => affectedIds.Contains(x.WorkItemId) && x.Status != "approved" && x.Status != "rejected").ToListAsync(ct);
            foreach (var run in runs) run.Cancel();
            var executionRuns = await db.ExecutionRuns.Where(x => affectedIds.Contains(x.WorkItemId) && x.Status != "submitted" && x.Status != "cancelled").ToListAsync(ct);
            foreach (var run in executionRuns) run.Cancel(now);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "work-item-chain.cancelled", "work-item", root.Id, now));
            foreach (var affectedSiteId in items.Select(x => x.SiteId).Distinct().Where(x => x != siteId)) db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), affectedSiteId, personId, "work-item-chain.cancelled-by-parent-site", "work-item", root.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { affected = affectedIds.Count });
        });
    }
}
