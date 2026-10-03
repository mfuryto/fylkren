using System.Text.RegularExpressions;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Notifications;

internal static class NotificationEventProjector
{
    internal static string? Kind(string value) => value switch
    {
        "work-item.registered" or "work-item.delegated" or "work-item.processing-delegated" or
        "work-item.reassignment-created" or
        "work-item.received-from-parent-site" or "work-item.request-received" or
        "work-item.internal-request-received" => "new-work-item",
        "workflow.submitted-for-approval" => "planning-completed",
        "execution.submitted-for-review" => "execution-completed",
        "work-item.completed" => "child-work-completed",
        "work-item.final-report-updated" => "decision-required",
        "work-item.assigned" or "work-item.under_review" or "work-item.in_progress" or "work-item.planning" or "work-item.execution" or "work-item.on_hold" or "work-item.rejected" or
        "work-item.request-cancelled-by-sender" => "work-item-changed",
        _ => null
    };
    internal static async Task<Guid> NotificationSite(FylkrenDbContext db, ActivityAudit.AuditEvent audit, Guid eventSiteId, string kind, CancellationToken ct)
    {
        if (kind != "child-work-completed" || audit.EntityType != "work-item")
        {
            return eventSiteId;
        }

        return await db.WorkItems
            .Where(x => x.Id == audit.EntityId && x.ParentWorkItem != null)
            .Select(x => (Guid?)x.ParentWorkItem!.SiteId)
            .SingleOrDefaultAsync(ct) ?? eventSiteId;
    }
    internal static async Task<bool> Enabled(FylkrenDbContext db, Guid siteId, string kind, CancellationToken ct)
    {
        if (!await db.Sites.AsNoTracking().AnyAsync(site => site.Id == siteId && site.IsActive, ct))
        {
            return false;
        }

        var settings = await db.SiteNotificationSettings
            .AsNoTracking()
            .SingleOrDefaultAsync(x => x.SiteId == siteId, ct);
        if (settings == null)
        {
            return false;
        }

        return kind switch
        {
            "new-work-item" => settings.NewWorkItems,
            "work-item-changed" => settings.WorkItemChanges,
            "decision-required" => settings.DecisionsRequired,
            "child-work-completed" => settings.ChildWorkCompleted,
            "planning-completed" => settings.PlanningCompleted || settings.DecisionsRequired,
            "execution-completed" => settings.ExecutionCompleted || settings.DecisionsRequired,
            _ => false
        };
    }
    internal static async Task Enqueue(FylkrenDbContext db, ActivityAudit.AuditEvent audit, Guid siteId, string kind, string publicUrl, CancellationToken ct)
    {
        var itemId = await ResolveWorkItemId(db, audit, ct);
        if (itemId == null)
        {
            return;
        }

        var item = await db.WorkItems
            .AsNoTracking()
            .Include(x => x.Site)
            .Include(x => x.AssignedUnit)
            .Include(x => x.WorkItemType)
            .SingleOrDefaultAsync(x => x.Id == itemId, ct);
        if (item == null)
        {
            return;
        }

        var notificationSite = siteId == item.SiteId
            ? item.Site
            : await db.Sites.AsNoTracking().SingleAsync(x => x.Id == siteId, ct);
        var targetUnit = await ResolveTargetUnit(db, item, siteId, kind, ct);
        if (targetUnit == null)
        {
            return;
        }

        var now = DateTimeOffset.UtcNow;
        var recipients = await LoadRecipients(db, siteId, targetUnit.Value, now, ct);
        var template = await db.NotificationTemplates.AsNoTracking().SingleAsync(x => x.Key == kind, ct);
        var fields = await BuildFields(db, audit, item, notificationSite, siteId, kind, publicUrl, ct);
        var personIds = recipients.Select(x => x.PersonId).ToList();
        var personal = await db.PersonalNotificationSettings
            .AsNoTracking()
            .Where(x => x.SiteId == siteId && personIds.Contains(x.PersonId))
            .ToDictionaryAsync(x => x.PersonId, ct);

        foreach (var recipient in recipients)
        {
            if (personal.TryGetValue(recipient.PersonId, out var preference) &&
                !PersonalEnabled(preference, kind))
            {
                continue;
            }

            fields["recipientName"] = recipient.DisplayName;
            var message = new NotificationOutboxMessage(
                Guid.NewGuid(), audit.Id, siteId, item.Id, recipient.PersonId,
                recipient.Email!, MailHeaderPolicy.Normalize(recipient.DisplayName, 200),
                MailHeaderPolicy.Normalize(Render(template.Subject, fields), 200),
                Render(template.Body, fields), MailHeaderPolicy.Normalize(notificationSite.Name, 200),
                audit.OccurredAt);
            if (audit.DomainEventId is null && await db.NotificationOutboxMessages.AnyAsync(m => m.AuditEventId == audit.Id && m.RecipientPersonId == recipient.PersonId, ct)) continue;
            if (audit.DomainEventId is Guid eventId) message.LinkEvent(eventId, kind);
            db.NotificationOutboxMessages.Add(message);
        }
    }

    internal static async Task<Guid?> ResolveWorkItemId(
        FylkrenDbContext db, ActivityAudit.AuditEvent audit, CancellationToken ct)
    {
        return audit.EntityType switch
        {
            "work-item" => audit.EntityId,
            "workflow-run" => await db.WorkflowRuns.Where(x => x.Id == audit.EntityId)
                .Select(x => (Guid?)x.WorkItemId).SingleOrDefaultAsync(ct),
            "execution-run" => await db.ExecutionRuns.Where(x => x.Id == audit.EntityId)
                .Select(x => (Guid?)x.WorkItemId).SingleOrDefaultAsync(ct),
            _ => null
        };
    }

    internal static async Task<Guid?> ResolveTargetUnit(
        FylkrenDbContext db, WorkItem item, Guid siteId, string kind, CancellationToken ct)
    {
        if (kind != "child-work-completed")
        {
            return item.AssignedUnitId ?? await LeadershipUnit(db, siteId, ct);
        }

        if (item.ParentWorkItemId is not Guid parentId)
        {
            return null;
        }

        var parentUnitId = await db.WorkItems.AsNoTracking()
            .Where(x => x.Id == parentId)
            .Select(x => x.AssignedUnitId)
            .SingleAsync(ct);
        return parentUnitId ?? await LeadershipUnit(db, siteId, ct);
    }

    internal static Task<Guid?> LeadershipUnit(FylkrenDbContext db, Guid siteId, CancellationToken ct) =>
        db.OrganizationUnits
            .Where(x => x.SiteId == siteId && x.IsActive && x.IsSiteLeadership)
            .Select(x => (Guid?)x.Id)
            .SingleOrDefaultAsync(ct);

    private static async Task<List<NotificationRecipient>> LoadRecipients(
        FylkrenDbContext db, Guid siteId, Guid targetUnit, DateTimeOffset now, CancellationToken ct)
    {
        return await db.RoleAssignments.AsNoTracking()
            .Where(a => a.IsActive && a.ValidFrom <= now && (a.ValidTo == null || a.ValidTo >= now) &&
                a.Role.IsActive && a.Role.OrganizationUnit.SiteId == siteId &&
                a.Role.OrganizationUnit.Site.IsActive && a.Role.OrganizationUnit.IsActive &&
                (a.Role.IsLeader || a.Role.HasLeaderAccess || a.Role.CanPlan) &&
                (a.Role.OrganizationUnitId == targetUnit ||
                 a.Role.OrganizationUnit.WorksAtParentLevel && a.Role.OrganizationUnit.ParentId == targetUnit ||
                 a.CanLeadParentLevel && a.Role.IsLeader && a.Role.OrganizationUnit.ParentId == targetUnit) &&
                a.Person.IsActive && a.Person.Email != null)
            .Select(a => new NotificationRecipient(a.PersonId, a.Person.DisplayName, a.Person.Email!))
            .Distinct()
            .ToListAsync(ct);
    }

    internal static async Task<Dictionary<string, string>> BuildFields(
        FylkrenDbContext db, ActivityAudit.AuditEvent audit, WorkItem item,
        Site notificationSite, Guid siteId, string kind, string publicUrl,
        CancellationToken ct)
    {
        var actor = await db.People.Where(x => x.Id == audit.ActorPersonId)
            .Select(x => x.DisplayName).SingleOrDefaultAsync(ct) ?? audit.ActorSiteName ?? "";
        var route = kind == "planning-completed" && audit.EntityType == "workflow-run"
            ? $"planning?site={siteId}&run={audit.EntityId}"
            : kind == "execution-completed"
                ? $"execution?site={siteId}&item={item.Id}"
                : $"tasks?site={siteId}&item={item.Id}";
        var levelName = kind == "child-work-completed"
            ? notificationSite.Name
            : item.AssignedUnit?.Name ?? item.Site.Name;

        return new Dictionary<string, string>
        {
            ["recipientName"] = "",
            ["siteName"] = notificationSite.Name,
            ["levelName"] = levelName,
            ["level"] = levelName,
            ["title"] = item.Title,
            ["taskType"] = item.WorkItemType?.Name ?? item.WorkItemTypeNameSnapshot ?? "",
            ["priority"] = item.Priority,
            ["status"] = item.Status,
            ["deadline"] = item.DueAt?.ToString("yyyy-MM-dd HH:mm") ?? "",
            ["actionRequired"] = kind is "planning-completed" or "execution-completed" or "decision-required"
                ? "Manager review required" : "",
            ["actorName"] = item.SenderPersonName ?? actor,
            ["reportingUnit"] = item.Site.Name,
            ["link"] = $"{publicUrl}/#/{route}",
            ["classification"] = item.FinalReportClassification ?? ""
        };
    }

    internal static bool PersonalEnabled(PersonalNotificationSettings p, string kind) => kind switch
    {
        "new-work-item" => p.NewWorkItems,
        "work-item-changed" => p.WorkItemChanges,
        "decision-required" => p.DecisionsRequired,
        "child-work-completed" => p.ChildWorkCompleted,
        "planning-completed" => p.PlanningCompleted || p.DecisionsRequired,
        "execution-completed" => p.ExecutionCompleted || p.DecisionsRequired,
        _ => true
    };
    internal static string Render(string value, IReadOnlyDictionary<string, string> fields) => Regex.Replace(value, @"\{\{([A-Za-z][A-Za-z0-9]*)\}\}", m => fields.GetValueOrDefault(m.Groups[1].Value, ""));

    private sealed record NotificationRecipient(Guid PersonId, string DisplayName, string Email);
}
