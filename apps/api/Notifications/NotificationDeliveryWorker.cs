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
    ILogger<NotificationDeliveryWorker> logger) : BackgroundService
{
    private static readonly Guid SmtpId = Guid.Parse("00000000-0000-0000-0000-000000000002");
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await Deliver(stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                logger.LogError(ex, "Notification worker cycle failed");
            }

            await Task.Delay(TimeSpan.FromSeconds(15), stoppingToken);
        }
    }

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
            var now = DateTimeOffset.UtcNow;
            var claimed = await DeliveryClaims.Notification(db, message.Id, now, ct);
            if (claimed != 1) continue;
            await db.Entry(message).ReloadAsync(ct);
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
                using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(30));
                await client.SendMailAsync(mail, timeout.Token);
                message.Sent(DateTimeOffset.UtcNow);
            }
            catch (Exception ex) when (ex is not OperationCanceledException || !ct.IsCancellationRequested)
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
