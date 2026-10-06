using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Licensing;

internal static class LicenseEndpoints
{
    internal static void MapLicenseEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/license")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("", async (FylkrenDbContext db, LicenseService service, CancellationToken ct) =>
            Results.Ok(new { status = await service.Current(db, ct), trustedIssuerConfigured = service.HasTrustedIssuer }));
        group.MapPost("", Import);
        group.MapDelete("", Remove);
    }

    private static async Task<IResult> Import(LicenseEnvelope request, ClaimsPrincipal user,
        IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, LicenseService service, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        if (!service.HasTrustedIssuer)
            return Results.Problem(statusCode: 503, title: "No trusted licence issuer is configured.");
        if (request.Payload is null || request.Signature is null || request.Payload.Length > 24_000 ||
            request.Signature.Length > 256 || request.SignatureAlgorithm?.Length > 80)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["license"] = ["The licence file has an invalid format or size."] });
        var instanceId = await db.InstanceIdentities.AsNoTracking().Where(x => x.Key == 1).Select(x => x.InstanceId).SingleAsync(ct);
        var evaluated = service.Evaluate(request.Payload, request.Signature, instanceId,
            DateTimeOffset.UtcNow, request.SignatureAlgorithm);
        if (evaluated.State != "valid")
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["license"] = [$"The licence was not activated: {evaluated.State}."] });
        var existing = await db.InstalledLicenses.SingleOrDefaultAsync(x => x.Key == 1, ct);
        if (existing is null) db.InstalledLicenses.Add(new InstalledLicense(request.Payload, request.Signature,
            request.SignatureAlgorithm, actor, DateTimeOffset.UtcNow));
        else existing.Replace(request.Payload, request.Signature, request.SignatureAlgorithm, actor, DateTimeOffset.UtcNow);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, "license.imported", "enterprise-license", evaluated.LicenseId!.Value, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.Ok(new { status = evaluated, trustedIssuerConfigured = true });
    }

    private static async Task<IResult> Remove(ClaimsPrincipal user, IAntiforgery antiforgery,
        HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out var actor)) return Results.Problem(statusCode: 403);
        var existing = await db.InstalledLicenses.SingleOrDefaultAsync(x => x.Key == 1, ct);
        if (existing is null) return Results.NoContent();
        db.InstalledLicenses.Remove(existing);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, "license.removed", "enterprise-license", Guid.Empty, DateTimeOffset.UtcNow));
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private sealed record LicenseEnvelope(string? Payload, string? Signature, string? SignatureAlgorithm = null);
}
