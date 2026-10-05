using Fylkren.Api.Networking;
using System.Net;
using System.Net.Mail;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;
using Fylkren.Api.Persistence;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Notifications;

namespace Fylkren.Api.Platform;

public static class SmtpEndpoints
{
    private static readonly Guid Id = Guid.Parse("00000000-0000-0000-0000-000000000002");
    private static readonly Guid ProjectionCursorId = Guid.Parse("00000000-0000-0000-0000-000000000003");
    private static readonly HashSet<string> AllowedTemplateFields = new(StringComparer.Ordinal)
    {
        "recipientName", "siteName", "levelName", "title", "taskType", "priority", "status", "deadline",
        "actionRequired", "actorName", "reportingUnit", "link", "classification", "level"
    };
    public static IEndpointRouteBuilder MapSmtpEndpoints(this IEndpointRouteBuilder e)
    {
        var g = e.MapGroup("/api/platform/smtp").RequireAuthorization(p => p.RequireRole("PlatformManager"));
        g.MapGet("/", GetSettings);
        g.MapGet("/templates", GetTemplates);
        g.MapGet("/deliveries", GetDeliveries);
        g.MapPut("/templates/{key}", UpdateTemplate);
        g.MapPut("/", UpdateSettings);
        g.MapPost("/test", SendTestMessage).RequireRateLimiting("integration-test");
        return e;
    }

    private static async Task<IResult> GetSettings(
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var value = await database.SmtpSettings.AsNoTracking()
            .SingleAsync(settings => settings.Id == Id, cancellationToken);
        return Results.Ok(new
        {
            value.Enabled,
            value.Host,
            value.Port,
            value.Security,
            value.Username,
            hasPassword = value.ProtectedPassword != null,
            value.FromAddress,
            value.FromName,
            value.LastTestedAt,
            value.LastTestSucceeded,
            value.LastTestError
        });
    }

    private static async Task<IResult> GetTemplates(
        FylkrenDbContext database,
        CancellationToken cancellationToken) =>
        Results.Ok(await database.NotificationTemplates.AsNoTracking()
            .OrderBy(template => template.Key)
            .Select(template => new { template.Key, template.Subject, template.Body })
            .ToListAsync(cancellationToken));

    private static async Task<IResult> GetDeliveries(
        string? status,
        int? page,
        int? pageSize,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (RequestQueryPolicy.Validate(page, null, pageSize) is { } queryError) return queryError;
        var normalizedStatus = status?.Trim().ToLowerInvariant();
        if (normalizedStatus is not (null or "" or "pending" or "sent" or "failed"))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["status"] = ["Status must be pending, sent, or failed."]
            });

        var smtp = await database.SmtpSettings.AsNoTracking()
            .SingleAsync(settings => settings.Id == Id, cancellationToken);
        var cursor = await database.NotificationProjectionCursors.AsNoTracking()
            .SingleAsync(value => value.Id == ProjectionCursorId, cancellationToken);
        var projectionBacklog = await database.EventProjections.AsNoTracking().LongCountAsync(value =>
            value.Consumer == "notifications" && value.Status != "completed" && value.Status != "skipped", cancellationToken);
        var projectedAt = await database.EventProjections.AsNoTracking().Where(p => p.Consumer == "notifications")
            .MaxAsync(p => p.CompletedAt, cancellationToken) ?? cursor.LastOccurredAt;
        var query = database.NotificationOutboxMessages.AsNoTracking();
        if (!string.IsNullOrEmpty(normalizedStatus))
            query = query.Where(message => message.Status == normalizedStatus);

        var effectivePage = Math.Max(page ?? 1, 1);
        var effectivePageSize = Math.Clamp(pageSize ?? 25, 1, 100);
        var total = await query.LongCountAsync(cancellationToken);
        var items = await query
            .OrderByDescending(message => message.CreatedAt)
            .ThenByDescending(message => message.Id)
            .Skip((effectivePage - 1) * effectivePageSize)
            .Take(effectivePageSize)
            .Select(message => new
            {
                message.Id,
                message.SiteId,
                siteName = database.Sites.Where(site => site.Id == message.SiteId)
                    .Select(site => site.Name).FirstOrDefault(),
                message.WorkItemId,
                workItemTitle = database.WorkItems.Where(item => item.Id == message.WorkItemId)
                    .Select(item => item.Title).FirstOrDefault(),
                message.RecipientName,
                message.RecipientEmail,
                message.Subject,
                message.Status,
                message.Attempts,
                message.CreatedAt,
                message.NextAttemptAt,
                message.SentAt,
                message.LastError
            })
            .ToListAsync(cancellationToken);
        var pending = await database.NotificationOutboxMessages.AsNoTracking()
            .LongCountAsync(message => message.Status == "pending", cancellationToken);
        var failed = await database.NotificationOutboxMessages.AsNoTracking()
            .LongCountAsync(message => message.Status == "failed", cancellationToken);

        return Results.Ok(new
        {
            transportEnabled = smtp.Enabled,
            lastProjectedAt = projectedAt,
            projectionBacklog,
            pending,
            failed,
            items,
            page = effectivePage,
            pageSize = effectivePageSize,
            total,
            totalPages = Math.Max(1L, NumericBounds.Pages(total, effectivePageSize))
        });
    }

    private static async Task<IResult> UpdateTemplate(
        string key,
        TemplateUpdate request,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var subject = request.Subject?.Trim() ?? string.Empty;
        var body = request.Body?.Trim() ?? string.Empty;
        if (subject.Length < 1 || !MailHeaderPolicy.IsValidConfigurationValue(subject, 200) ||
            body.Length is < 1 or > 10000)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["template"] = ["The subject and message must be provided within the allowed length."]
            });
        var unknownFields = Regex.Matches($"{subject}\n{body}", @"\{\{([A-Za-z][A-Za-z0-9]*)\}\}")
            .Select(match => match.Groups[1].Value)
            .Where(field => !AllowedTemplateFields.Contains(field))
            .Distinct(StringComparer.Ordinal)
            .OrderBy(field => field)
            .ToArray();
        if (unknownFields.Length > 0)
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["template"] = [$"Ukjente malfelt: {string.Join(", ", unknownFields)}."]
            });

        var template = await database.NotificationTemplates
            .SingleOrDefaultAsync(value => value.Key == key, cancellationToken);
        if (template is null) return Results.NotFound();
        template.Update(subject, body);
        Record(database, context, "notification-template.updated", template.Id);
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> UpdateSettings(
        SmtpUpdate request,
        IAntiforgery antiforgery,
        HttpContext context,
        IDataProtectionProvider dataProtection,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        var host = request.Host?.Trim() ?? string.Empty;
        var fromAddress = request.FromAddress?.Trim() ?? string.Empty;
        var username = request.Username?.Trim();
        var fromName = request.FromName?.Trim() ?? string.Empty;
        if (!ServiceDestinationPolicy.ValidServer(host) || request.Port is < 1 or > 65535 ||
            request.Security != "starttls" || username?.Length > 255 ||
            request.Password?.Length > 1000 || fromName.Length < 1 ||
            !MailHeaderPolicy.IsValidConfigurationValue(fromName, 200) ||
            !MailAddress.TryCreate(fromAddress, out _))
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["smtp"] = ["Check the server, port, security, username, and sender."]
            });

        var value = await database.SmtpSettings.SingleAsync(settings => settings.Id == Id, cancellationToken);
        var protectedPassword = value.ProtectedPassword;
        if (request.ClearPassword)
            protectedPassword = null;
        else if (!string.IsNullOrEmpty(request.Password))
            protectedPassword = dataProtection.CreateProtector("Fylkren.SmtpPassword.v1")
                .Protect(request.Password);
        value.Update(request.Enabled, host, request.Port, request.Security, username,
            protectedPassword, fromAddress, fromName);
        Record(database, context, "smtp.updated");
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> SendTestMessage(
        SmtpTest request,
        IAntiforgery antiforgery,
        HttpContext context,
        IDataProtectionProvider dataProtection,
        FylkrenDbContext database,
        ILoggerFactory loggerFactory,
        ServiceDestinationPolicy destinations,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!MailAddress.TryCreate(request.Recipient?.Trim(), out var recipient))
            return Results.BadRequest(new { error = "Invalid test recipient." });
        var value = await database.SmtpSettings.SingleAsync(settings => settings.Id == Id, cancellationToken);
        try
        {
            using var message = new MailMessage(
                new MailAddress(value.FromAddress, MailHeaderPolicy.Normalize(value.FromName, 200)), recipient)
            {
                Subject = "Email configuration test",
                Body = "This is a test message from the configured installation."
            };
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
            timeout.CancelAfter(TimeSpan.FromSeconds(10));
            try { await SmtpTransport.SendAsync(value, dataProtection.CreateProtector("Fylkren.SmtpPassword.v1"), destinations, message, timeout.Token); }
            catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
            { throw new SmtpException("SMTP test delivery timed out."); }
            value.RecordTest(true, null);
            await database.SaveChangesAsync(cancellationToken);
            return Results.NoContent();
        }
        catch (Exception exception) when (exception is SmtpException or InvalidOperationException or
                                               System.Security.Cryptography.CryptographicException)
        {
            loggerFactory.CreateLogger("SmtpTest").LogWarning(exception, "SMTP-test mislyktes");
            value.RecordTest(false, "Connection or delivery failed. See the technical logs.");
            await database.SaveChangesAsync(cancellationToken);
            return Results.Problem(statusCode: 502, title: "The test delivery failed.");
        }
    }
    private sealed record SmtpUpdate(bool Enabled, string Host, int Port, string Security, string? Username, string? Password, bool ClearPassword, string FromAddress, string FromName);
    private sealed record SmtpTest(string Recipient);
    private sealed record TemplateUpdate(string? Subject, string? Body);
    private static void Record(FylkrenDbContext database, HttpContext context, string eventType, Guid? entityId = null)
    {
        if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor))
            database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, eventType,
                entityId is null ? "smtp-settings" : "notification-template", entityId ?? Id,
                DateTimeOffset.UtcNow));
    }
}
