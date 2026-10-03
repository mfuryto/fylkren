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
        await using var transaction = await db.Database.BeginTransactionAsync(ct);
        var events = await db.DomainEvents.FromSqlRaw("SELECT e.* FROM domain_events e WHERE EXISTS (SELECT 1 FROM event_projections p WHERE p.domain_event_id = e.id AND p.consumer = 'webhooks' AND p.status IN ('pending','processing') AND p.next_attempt_at <= now() AND (p.lease_expires_at IS NULL OR p.lease_expires_at <= now())) ORDER BY e.occurred_at, e.id LIMIT 200 FOR UPDATE OF e SKIP LOCKED").ToListAsync(ct);
        foreach (var e in events)
        {
            var subscriptions = await db.WebhookSubscriptions.AsNoTracking().Where(x => x.SiteId == e.SiteId && x.IsActive && x.CreatedAt <= e.OccurredAt && !db.WebhookDeliveries.Any(d => d.SubscriptionId == x.Id && d.DomainEventId == e.Id)).ToListAsync(ct);
            foreach (var s in subscriptions.Where(x => x.SelectedEventTypes().Contains(e.EventType) && (e.Source == "legacy" || e.ResourceType != "work_item"))) db.WebhookDeliveries.Add(new WebhookDelivery(Guid.NewGuid(), s.Id, e.Id, DateTimeOffset.UtcNow));
            var projection = await db.EventProjections.SingleOrDefaultAsync(x => x.Consumer == "webhooks" && x.DomainEventId == e.Id, ct);
            if (projection is not null)
            {
                var owner = Guid.NewGuid(); projection.Claim(owner, DateTimeOffset.UtcNow);
                projection.Complete(owner, DateTimeOffset.UtcNow, !DomainEventTypes.ExternallySupported.Contains(e.EventType));
            }
        }
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);
    }
    private async Task Deliver(CancellationToken ct)
    {
        await using var scope = scopes.CreateAsyncScope(); var db = scope.ServiceProvider.GetRequiredService<FylkrenDbContext>(); var now = DateTimeOffset.UtcNow;
        var ids = await db.WebhookDeliveries.AsNoTracking().Where(x => (x.Status == "pending" || x.Status == "retry" || (x.Status == "delivering" && x.LastAttemptAt < now.AddMinutes(-5))) && x.NextAttemptAt <= now).OrderBy(x => x.NextAttemptAt).Take(20).Select(x => x.Id).ToListAsync(ct);
        foreach (var id in ids) await DeliverOne(db, id, ct);
    }
    private async Task DeliverOne(FylkrenDbContext db, Guid id, CancellationToken ct)
    {
        var started = DateTimeOffset.UtcNow;
        var claimed = await DeliveryClaims.Webhook(db, id, started, ct);
        if (claimed != 1) return;
        var delivery = await db.WebhookDeliveries.Include(x => x.Subscription).Include(x => x.DomainEvent).SingleAsync(x => x.Id == id, ct);
        await db.Entry(delivery).ReloadAsync(ct);
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
