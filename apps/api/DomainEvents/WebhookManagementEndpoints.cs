using System.Security.Claims;
using System.Security.Cryptography;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.DomainEvents;

internal static class WebhookManagementEndpoints
{
    internal static void MapWebhookManagementEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/webhooks").RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("/catalog", () => Results.Ok(DomainEventTypes.ExternallySupported.Select(type => new { eventType = type, schemaVersion = 1 })));
        group.MapGet("/sites", async (FylkrenDbContext db, CancellationToken ct) => Results.Ok(await db.Sites.AsNoTracking().Where(x => x.IsActive).OrderBy(x => x.Name).Select(x => new { id = x.Id, x.Name }).ToListAsync(ct)));
        group.MapGet("/sites/{siteId:guid}", Get);
        group.MapPost("/sites/{siteId:guid}", Create).RequireFeature(FeatureCatalog.Webhooks);
        group.MapDelete("/sites/{siteId:guid}/{id:guid}", Deactivate);
        group.MapGet("/sites/{siteId:guid}/deliveries", Deliveries);
    }
    private static async Task<IResult> Get(Guid siteId, FylkrenDbContext db, CancellationToken ct) => Results.Ok(await db.WebhookSubscriptions.AsNoTracking().Where(x => x.SiteId == siteId).OrderByDescending(x => x.CreatedAt).Select(x => new { x.Id, x.Name, x.EndpointUrl, x.EventTypes, x.IsActive, x.CreatedAt, x.UpdatedAt }).ToListAsync(ct));
    private static async Task<IResult> Create(Guid siteId, CreateWebhookRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, IDataProtectionProvider protection, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId)) return Results.Problem(statusCode: 403);
        if (!await db.Sites.AnyAsync(x => x.Id == siteId && x.IsActive, ct)) return Results.NotFound();
        var name = request.Name?.Trim() ?? string.Empty;
        if (name.Length is < 2 or > 120) return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The webhook name must be between 2 and 120 characters."] });
        if (request.EndpointUrl?.Length > 2000 || !Uri.TryCreate(request.EndpointUrl, UriKind.Absolute, out var uri) || !Fylkren.Api.Networking.OutboundHttpPolicy.ValidUri(uri)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["endpointUrl"] = ["The webhook address must be an absolute HTTPS address of at most 2,000 characters."] });
        if (request.EventTypes is null || request.EventTypes.Any(x => x is null)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["eventTypes"] = ["Select at least one supported event type."] });
        var selected = request.EventTypes.Distinct(StringComparer.Ordinal).ToArray();
        if (selected.Length == 0 || selected.Any(x => !DomainEventTypes.ExternallySupported.Contains(x))) return Results.ValidationProblem(new Dictionary<string, string[]> { ["eventTypes"] = ["Select at least one supported event type."] });
        var secret = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant(); var now = DateTimeOffset.UtcNow;
        var subscription = new WebhookSubscription(Guid.NewGuid(), siteId, name, uri.ToString(), protection.CreateProtector("Fylkren.Webhooks.v1").Protect(secret), string.Join(' ', selected), personId, now);
        db.WebhookSubscriptions.Add(subscription); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "webhook.created", "webhook-subscription", subscription.Id, now)); await db.SaveChangesAsync(ct);
        return Results.Created($"/api/platform/webhooks/sites/{siteId}/{subscription.Id}", new { subscription.Id, subscription.Name, subscription.EndpointUrl, eventTypes = selected, secret });
    }
    private static async Task<IResult> Deactivate(Guid siteId, Guid id, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest(); if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var personId)) return Results.Problem(statusCode: 403);
        var value = await db.WebhookSubscriptions.SingleOrDefaultAsync(x => x.Id == id && x.SiteId == siteId, ct); if (value is null) return Results.NotFound(); value.Deactivate(DateTimeOffset.UtcNow); db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, "webhook.deactivated", "webhook-subscription", id, DateTimeOffset.UtcNow)); await db.SaveChangesAsync(ct); return Results.NoContent();
    }
    private static async Task<IResult> Deliveries(Guid siteId, int? page, FylkrenDbContext db, CancellationToken ct)
    {
        if (RequestQueryPolicy.Validate(page, null) is { } error) return error;
        var safePage = page ?? 1; const int size = 20; var query = db.WebhookDeliveries.AsNoTracking().Where(x => x.Subscription.SiteId == siteId).OrderByDescending(x => x.CreatedAt);
        return Results.Ok(new { page = safePage, pageSize = size, total = await query.LongCountAsync(ct), items = await query.Skip((safePage - 1) * size).Take(size).Select(x => new { x.Id, x.SubscriptionId, subscriptionName = x.Subscription.Name, x.DomainEventId, eventType = x.DomainEvent.EventType, x.Status, x.AttemptCount, x.LastAttemptAt, x.CompletedAt, x.LastHttpStatus, x.LastError, x.CreatedAt }).ToListAsync(ct) });
    }
    private sealed record CreateWebhookRequest(string? Name, string? EndpointUrl, string?[]? EventTypes);
}
