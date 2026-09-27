using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Routing;
using Microsoft.EntityFrameworkCore;
using static Fylkren.Api.Platform.AdministrationApiSupport;

namespace Fylkren.Api.Platform;

internal static class AdministrationClassificationEndpoints
{
    internal static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/classifications", async (FylkrenDbContext db, CancellationToken ct) =>
        {
            var enabled = await db.ClassificationSettings.AsNoTracking()
                .Where(value => value.Id == ClassificationEndpoints.SettingsId)
                .Select(value => value.IsEnabled)
                .SingleAsync(ct);
            var items = await db.ClassificationDefinitions.AsNoTracking()
                .OrderBy(value => value.SortOrder)
                .ThenBy(value => value.Name)
                .Select(value => new { value.Id, value.Name, value.Abbreviation, value.SortOrder, value.IsActive })
                .ToListAsync(ct);
            return Results.Ok(new { enabled, items });
        }).RequireAuthorization(policy => policy.RequireClaim("scope", "classifications:read"))
          .RequireRateLimiting("administration-api");

        api.MapPut("/classifications/settings", async (ClassificationSettingsRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
            var settings = await db.ClassificationSettings.SingleAsync(value => value.Id == ClassificationEndpoints.SettingsId, ct);
            settings.SetEnabled(request.Enabled);
            AddAudit(db, machineId, "classification.settings-updated", "classification-settings", settings.Id, context);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization(policy => policy.RequireClaim("scope", "classifications:write"))
          .RequireRateLimiting("administration-api-write");

        api.MapPost("/classifications", async (ClassificationRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
            var validation = Validate(request);
            if (validation is not null) return validation;
            var abbreviation = request.Abbreviation!.Trim().ToUpperInvariant();
            if (await db.ClassificationDefinitions.AnyAsync(value => value.Abbreviation == abbreviation, ct))
                return Validation("abbreviation", "Kortformen er allerede i bruk.");
            var value = new ClassificationDefinition(Guid.NewGuid(), request.Name!, abbreviation, request.SortOrder);
            if (!request.IsActive) value.Update(request.Name!, abbreviation, request.SortOrder, false);
            db.ClassificationDefinitions.Add(value);
            AddAudit(db, machineId, "classification.created", "classification-definition", value.Id, context);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/v1/administration/classifications/{value.Id}", new { value.Id, value.Name, value.Abbreviation, value.SortOrder, value.IsActive });
        }).RequireAuthorization(policy => policy.RequireClaim("scope", "classifications:write"))
          .RequireRateLimiting("administration-api-write");

        api.MapPut("/classifications/{id:guid}", async (Guid id, ClassificationRequest request, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
            var validation = Validate(request);
            if (validation is not null) return validation;
            var value = await db.ClassificationDefinitions.SingleOrDefaultAsync(candidate => candidate.Id == id, ct);
            if (value is null) return Results.NotFound();
            var abbreviation = request.Abbreviation!.Trim().ToUpperInvariant();
            if (await db.ClassificationDefinitions.AnyAsync(candidate => candidate.Id != id && candidate.Abbreviation == abbreviation, ct))
                return Validation("abbreviation", "Kortformen er allerede i bruk.");
            value.Update(request.Name!, abbreviation, request.SortOrder, request.IsActive);
            AddAudit(db, machineId, "classification.updated", "classification-definition", value.Id, context);
            await db.SaveChangesAsync(ct);
            return Results.Ok(new { value.Id, value.Name, value.Abbreviation, value.SortOrder, value.IsActive });
        }).RequireAuthorization(policy => policy.RequireClaim("scope", "classifications:write"))
          .RequireRateLimiting("administration-api-write");

        api.MapDelete("/classifications/{id:guid}", async (Guid id, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!MachineId(context.User, out var machineId)) return Results.Unauthorized();
            var value = await db.ClassificationDefinitions.SingleOrDefaultAsync(candidate => candidate.Id == id, ct);
            if (value is null) return Results.NotFound();
            db.ClassificationDefinitions.Remove(value);
            AddAudit(db, machineId, "classification.deleted", "classification-definition", value.Id, context);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        }).RequireAuthorization(policy => policy.RequireClaim("scope", "classifications:write"))
          .RequireRateLimiting("administration-api-write");
    }

    private static IResult? Validate(ClassificationRequest request)
    {
        if ((request.Name?.Trim().Length ?? 0) is < 2 or > 100) return Validation("name", "Navnet må være mellom 2 og 100 tegn.");
        if ((request.Abbreviation?.Trim().Length ?? 0) is < 1 or > 12) return Validation("abbreviation", "Kortformen må være mellom 1 og 12 tegn.");
        if (request.SortOrder is < 0 or > 100000) return Validation("sortOrder", "Rekkefølgen må være mellom 0 og 100000.");
        return null;
    }

    private static void AddAudit(FylkrenDbContext db, Guid machineId, string eventType, string entityType, Guid entityId, HttpContext context) =>
        db.ApiMachineAuditEvents.Add(new ApiMachineAuditEvent(Guid.NewGuid(), machineId, null, eventType, entityType, entityId, context.TraceIdentifier, DateTimeOffset.UtcNow));

    private sealed record ClassificationSettingsRequest(bool Enabled);
    private sealed record ClassificationRequest(string? Name, string? Abbreviation, int SortOrder, bool IsActive = true);
}
