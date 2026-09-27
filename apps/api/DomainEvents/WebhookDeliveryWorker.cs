using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Fylkren.Api.Persistence;
using Fylkren.Api.Licensing;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.DomainEvents;

internal sealed class WebhookDeliveryWorker(IServiceScopeFactory scopes, IHttpClientFactory clients, IDataProtectionProvider protection, ILogger<WebhookDeliveryWorker> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await using var scope = scopes.CreateAsyncScope();
                var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
                var license = scope.ServiceProvider.GetRequiredService<LicenseService>();
                if (await license.Has(db, FeatureCatalog.Webhooks, ct)) { await Project(ct); await Deliver(ct); }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested) { break; }
            catch (Exception ex) { logger.LogError(ex, "Webhook processing failed."); }
            await Task.Delay(TimeSpan.FromSeconds(10), ct);
        }
    }
    private async Task Project(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>();
        var events = await db.DomainEvents.Where(x => x.WebhooksProjectedAt == null).OrderBy(x => x.OccurredAt).ThenBy(x => x.Id).Take(200).ToListAsync(ct);
        foreach (var e in events)
        {
            var subscriptions = await db.WebhookSubscriptions.AsNoTracking().Where(x => x.SiteId == e.SiteId && x.IsActive && x.CreatedAt <= e.OccurredAt && !db.WebhookDeliveries.Any(d => d.SubscriptionId == x.Id && d.DomainEventId == e.Id)).ToListAsync(ct);
            foreach (var s in subscriptions.Where(x => x.SelectedEventTypes().Contains(e.EventType))) db.WebhookDeliveries.Add(new WebhookDelivery(Guid.NewGuid(), s.Id, e.Id, DateTimeOffset.UtcNow));
            e.MarkWebhooksProjected(DateTimeOffset.UtcNow);
        }
        await db.SaveChangesAsync(ct);
    }
    private async Task Deliver(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>(); var now = DateTimeOffset.UtcNow;
        var ids = await db.WebhookDeliveries.AsNoTracking().Where(x => (x.Status == "pending" || x.Status == "retry" || (x.Status == "delivering" && x.LastAttemptAt < now.AddMinutes(-5))) && x.NextAttemptAt <= now).OrderBy(x => x.NextAttemptAt).Take(20).Select(x => x.Id).ToListAsync(ct);
        foreach (var id in ids) await DeliverOne(db, id, ct);
    }
    private async Task DeliverOne(FylkrenDbContext db, Guid id, CancellationToken ct)
    {
        var delivery = await db.WebhookDeliveries.Include(x => x.Subscription).Include(x => x.DomainEvent).SingleAsync(x => x.Id == id, ct); var started = DateTimeOffset.UtcNow; delivery.Start(started); await db.SaveChangesAsync(ct);
        int? status = null; string? error = null; var watch = Stopwatch.StartNew();
        try
        {
            var e = delivery.DomainEvent; var timestamp = e.OccurredAt.ToUnixTimeSeconds().ToString();
            var body = JsonSerializer.Serialize(new { id = e.Id, type = e.EventType, schemaVersion = e.SchemaVersion, timestamp = e.OccurredAt, siteId = e.SiteId, actorId = e.ActorPersonId, resource = new { type = e.ResourceType, id = e.ResourceId }, data = JsonSerializer.Deserialize<JsonElement>(e.PayloadJson) });
            var secret = protection.CreateProtector("Fylkren.Webhooks.v1").Unprotect(delivery.Subscription.ProtectedSecret); var signature = Convert.ToHexString(HMACSHA256.HashData(Encoding.UTF8.GetBytes(secret), Encoding.UTF8.GetBytes($"{timestamp}.{body}"))).ToLowerInvariant();
            using var request = new HttpRequestMessage(HttpMethod.Post, delivery.Subscription.EndpointUrl) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
            request.Headers.Add("X-Fylkren-Event-Id", e.Id.ToString()); request.Headers.Add("X-Fylkren-Event-Type", e.EventType); request.Headers.Add("X-Fylkren-Timestamp", timestamp); request.Headers.Add("X-Fylkren-Signature", $"v1={signature}");
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct); timeout.CancelAfter(TimeSpan.FromSeconds(10)); using var response = await clients.CreateClient("webhooks").SendAsync(request, HttpCompletionOption.ResponseHeadersRead, timeout.Token); status = (int)response.StatusCode;
            if (response.IsSuccessStatusCode) delivery.Succeed(DateTimeOffset.UtcNow, status.Value); else error = $"Receiver returned HTTP {status}.";
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or CryptographicException) { error = ex.Message; }
        if (error is not null) { var terminal = delivery.AttemptCount >= 6; var delays = new[] { 1, 5, 30, 120, 720, 1440 }; delivery.Fail(DateTimeOffset.UtcNow, status, error, TimeSpan.FromMinutes(delays[Math.Min(delivery.AttemptCount - 1, delays.Length - 1)]), terminal); }
        db.WebhookDeliveryAttempts.Add(new WebhookDeliveryAttempt(Guid.NewGuid(), delivery.Id, delivery.AttemptCount, started, watch.ElapsedMilliseconds, error is null ? "succeeded" : delivery.AttemptCount >= 6 ? "failed" : "retry", status, error)); await db.SaveChangesAsync(ct);
    }
}
