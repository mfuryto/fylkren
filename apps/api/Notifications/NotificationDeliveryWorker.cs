using System.Net;
using System.Net.Mail;
using System.Text.RegularExpressions;
using Fylkren.Api.Organization;
using Fylkren.Api.Persistence;
using Fylkren.Api.Platform;
using Fylkren.Api.WorkManagement;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Notifications;

public sealed class NotificationDeliveryWorker(
    IServiceScopeFactory scopes,
    FylkrenOptions options,
    ILogger<NotificationDeliveryWorker> logger) : BackgroundService
{
    private static readonly Guid CursorId = Guid.Parse("00000000-0000-0000-0000-000000000003");
    private static readonly Guid SmtpId = Guid.Parse("00000000-0000-0000-0000-000000000002");
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Project(stoppingToken);
                await Deliver(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Notification worker cycle failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }

    private async Task Project(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
        var cursor = await db.NotificationProjectionCursors.SingleAsync(x => x.Id == CursorId, ct);
        var events = await db.AuditEvents
            .AsNoTracking()
            .Where(x => x.OccurredAt > cursor.LastOccurredAt ||
                        x.OccurredAt == cursor.LastOccurredAt && x.Id.CompareTo(cursor.LastAuditEventId) > 0)
            .OrderBy(x => x.OccurredAt)
            .ThenBy(x => x.Id)
            .Take(100)
            .ToListAsync(ct);

        foreach (var audit in events)
        {
            var kind = Kind(audit.EventType);
            if (kind != null && audit.SiteId is Guid eventSiteId)
            {
                var notificationSiteId = await NotificationSite(db, audit, eventSiteId, kind, ct);
                if (await Enabled(db, notificationSiteId, kind, ct))
                {
                    await Enqueue(db, audit, notificationSiteId, kind, options.PublicUrl, ct);
                }
            }

            cursor.Advance(audit.OccurredAt, audit.Id);
        }

        if (events.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static string? Kind(string value) => value switch
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
    private static async Task<Guid> NotificationSite(FylkrenDbContext db, ActivityAudit.AuditEvent audit, Guid eventSiteId, string kind, CancellationToken ct)
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
    private static async Task<bool> Enabled(FylkrenDbContext db, Guid siteId, string kind, CancellationToken ct)
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
    private static async Task Enqueue(FylkrenDbContext db, ActivityAudit.AuditEvent audit, Guid siteId, string kind, string publicUrl, CancellationToken ct)
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
            db.NotificationOutboxMessages.Add(new NotificationOutboxMessage(
                Guid.NewGuid(), audit.Id, siteId, item.Id, recipient.PersonId,
                recipient.Email!, MailHeaderPolicy.Normalize(recipient.DisplayName, 200),
                MailHeaderPolicy.Normalize(Render(template.Subject, fields), 200),
                Render(template.Body, fields), MailHeaderPolicy.Normalize(notificationSite.Name, 200),
                audit.OccurredAt));
        }
    }

    private static async Task<Guid?> ResolveWorkItemId(
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

    private static async Task<Guid?> ResolveTargetUnit(
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

    private static Task<Guid?> LeadershipUnit(FylkrenDbContext db, Guid siteId, CancellationToken ct) =>
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

    private static async Task<Dictionary<string, string>> BuildFields(
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
                ? "Lederbehandling kreves" : "",
            ["actorName"] = item.SenderPersonName ?? actor,
            ["reportingUnit"] = item.Site.Name,
            ["link"] = $"{publicUrl}/#/{route}",
            ["classification"] = item.FinalReportClassification ?? ""
        };
    }

    private static bool PersonalEnabled(PersonalNotificationSettings p, string kind) => kind switch
    {
        "new-work-item" => p.NewWorkItems,
        "work-item-changed" => p.WorkItemChanges,
        "decision-required" => p.DecisionsRequired,
        "child-work-completed" => p.ChildWorkCompleted,
        "planning-completed" => p.PlanningCompleted || p.DecisionsRequired,
        "execution-completed" => p.ExecutionCompleted || p.DecisionsRequired,
        _ => true
    };
    private static string Render(string value, IReadOnlyDictionary<string, string> fields) => Regex.Replace(value, @"\{\{([A-Za-z][A-Za-z0-9]*)\}\}", m => fields.GetValueOrDefault(m.Groups[1].Value, ""));

    private async Task Deliver(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope();
        var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
        var smtp = await db.SmtpSettings.SingleAsync(x => x.Id == SmtpId, ct);
        if (!smtp.Enabled)
        {
            return;
        }

        var messages = await db.NotificationOutboxMessages
            .Where(x => x.Status == "pending" && x.NextAttemptAt <= DateTimeOffset.UtcNow)
            .OrderBy(x => x.CreatedAt)
            .Take(20)
            .ToListAsync(ct);
        var protector = scope.ServiceProvider.GetRequiredService<IDataProtectionProvider>()
            .CreateProtector("Fylkren.SmtpPassword.v1");

        foreach (var message in messages)
        {
            try
            {
                using var client = CreateSmtpClient(smtp, protector);
                using var mail = new MailMessage(
                    new MailAddress(smtp.FromAddress,
                        MailHeaderPolicy.Normalize($"{smtp.FromName} – {message.FromName}", 400)),
                    new MailAddress(message.RecipientEmail,
                        MailHeaderPolicy.Normalize(message.RecipientName, 200)))
                {
                    Subject = MailHeaderPolicy.Normalize(message.Subject, 200),
                    Body = message.Body
                };
                await client.SendMailAsync(mail, ct);
                message.Sent(DateTimeOffset.UtcNow);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                var reason = DeliveryFailure(ex);
                logger.LogWarning(ex,
                    "Notification {NotificationId} delivery failed on attempt {Attempt}: {Reason}",
                    message.Id, message.Attempts + 1, reason);
                message.Failed(DateTimeOffset.UtcNow, reason);
            }
        }
        if (messages.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static SmtpClient CreateSmtpClient(SmtpSettings smtp, IDataProtector protector)
    {
        var client = new SmtpClient(smtp.Host, smtp.Port)
        {
            EnableSsl = smtp.Security == "starttls",
            Timeout = 10000
        };
        if (smtp.Username == null)
        {
            return client;
        }

        if (smtp.ProtectedPassword == null)
        {
            client.Dispose();
            throw new InvalidOperationException("SMTP password missing");
        }

        client.Credentials = new NetworkCredential(
            smtp.Username, protector.Unprotect(smtp.ProtectedPassword));
        return client;
    }

    private static string DeliveryFailure(Exception exception)
    {
        var detail = TechnicalLogBuffer.Sanitize(exception.InnerException?.Message ?? exception.Message);
        var prefix = exception is SmtpException smtpException
            ? $"SMTP {smtpException.StatusCode}"
            : exception.GetType().Name;
        return $"{prefix}: {detail}";
    }

    private sealed record NotificationRecipient(Guid PersonId, string DisplayName, string Email);
}
