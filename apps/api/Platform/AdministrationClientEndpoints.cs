using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Licensing;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.Platform.AdministrationApiSupport;

namespace Fylkren.Api.Platform;

internal static class AdministrationClientEndpoints
{
    private static readonly HashSet<string> AllowedScopes =
    [
        "sites:read", "sites:write", "sites:move", "sites:deactivate",
        "users:read", "users:assign", "users:move", "users:deactivate",
        "classifications:read", "classifications:write", "reports:read",
        "work:read", "work:write", "work:transition", "activity:read",
        "decisions:write", "risks:write", "planning:write", "execution:write",
    ];

    internal static void Map(IEndpointRouteBuilder endpoints)
    {
        var platform = endpoints.MapGroup("/api/platform/api-clients")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        platform.MapGet("/", async (FylkrenDbContext db, CancellationToken ct) =>
        {
            var clients = await db.ApiMachineIdentities.AsNoTracking()
                .OrderBy(value => value.Name)
                .ToListAsync(ct);
            return Results.Ok(clients.Select(value => new
            {
                value.Id,
                value.Name,
                value.KeyId,
                value.AuthenticationMode,
                value.LegacyBearerAcceptedUntil,
                scopes = value.Scopes.Split(' ', StringSplitOptions.RemoveEmptyEntries),
                value.ExpiresAt,
                value.CreatedAt,
                value.LastUsedAt,
                value.IsActive,
            }));
        });

        platform.MapPost("/", async (CreateClient request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
            var name = request.Name?.Trim() ?? "";
            if (request.Scopes?.Any(value => value is null) == true)
                return Validation("scopes", "Scopes cannot contain empty entries.");
            var scopes = request.Scopes?.Where(value => value is not null)
                .Distinct(StringComparer.Ordinal)
                .Order()
                .ToArray() ?? [];
            var now = DateTimeOffset.UtcNow;
            if (name.Length is < 2 or > 120 || scopes.Length == 0 || scopes.Any(scope => !AllowedScopes.Contains(scope)))
                return Validation("client", "Check the name and scopes.");
            if (request.ExpiresAt is null || request.ExpiresAt <= now || request.ExpiresAt > now.AddDays(366))
                return Validation("expiresAt", "An expiry date is required and can be at most one year in the future.");
            var generated = ApiMachineSignatures.Create();
            var value = new ApiMachineIdentity(Guid.NewGuid(), name, generated.KeyId, generated.PublicKey,
                generated.Algorithm, string.Join(' ', scopes), request.ExpiresAt.Value, now);
            db.ApiMachineIdentities.Add(value);
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, "api-machine.created", "api-machine", value.Id, now));
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/platform/api-clients/{value.Id}", new
            {
                value.Id, value.Name, value.KeyId, scopes, value.ExpiresAt,
                value.AuthenticationMode, value.SignatureAlgorithm, privateKey = generated.PrivateKeyPem,
            });
        }).RequireFeature(FeatureCatalog.MachineApi);

        platform.MapDelete("/{id:guid}", async (Guid id, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
            var value = await db.ApiMachineIdentities.SingleOrDefaultAsync(candidate => candidate.Id == id, ct);
            if (value is null) return Results.NotFound();
            value.Deactivate();
            db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, "api-machine.deactivated", "api-machine", value.Id, DateTimeOffset.UtcNow));
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });
    }

    private sealed record CreateClient(string? Name, IReadOnlyList<string>? Scopes, DateTimeOffset? ExpiresAt);
}
