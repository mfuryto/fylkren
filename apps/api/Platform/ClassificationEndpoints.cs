using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Platform;

public static class ClassificationEndpoints
{
    public static readonly Guid SettingsId = Guid.Parse("00000000-0000-0000-0000-000000000006");

    public static IEndpointRouteBuilder MapClassificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform/classifications")
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));

        group.MapGet("/", async (FylkrenDbContext db, CancellationToken ct) =>
        {
            var enabled = await db.ClassificationSettings.AsNoTracking().Where(x => x.Id == SettingsId).Select(x => x.IsEnabled).SingleAsync(ct);
            var items = await db.ClassificationDefinitions.AsNoTracking().OrderBy(x => x.SortOrder).ThenBy(x => x.Name).Select(x => new { x.Id, x.Name, x.Abbreviation, x.SortOrder, x.IsActive }).ToListAsync(ct);
            return Results.Ok(new { enabled, items });
        });

        group.MapPut("/settings", async (UpdateSettings request, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var settings = await db.ClassificationSettings.SingleAsync(x => x.Id == SettingsId, ct);
            settings.SetEnabled(request.Enabled);
            Record(db, context, "classification.settings-updated", "classification-settings", settings.Id);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapPost("/", async (SaveDefinition request, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var validation = Validate(request);
            if (validation is not null) return validation;
            var abbreviation = request.Abbreviation!.Trim().ToUpperInvariant();
            if (await db.ClassificationDefinitions.AnyAsync(x => x.Abbreviation == abbreviation, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["abbreviation"] = ["Kortformen er allerede i bruk."] });
            var value = new ClassificationDefinition(Guid.NewGuid(), request.Name!, abbreviation, request.SortOrder);
            db.ClassificationDefinitions.Add(value);
            Record(db, context, "classification.created", "classification-definition", value.Id);
            await db.SaveChangesAsync(ct);
            return Results.Created($"/api/platform/classifications/{value.Id}", new { value.Id });
        });

        group.MapPut("/{id:guid}", async (Guid id, SaveDefinition request, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var validation = Validate(request);
            if (validation is not null) return validation;
            var value = await db.ClassificationDefinitions.SingleOrDefaultAsync(x => x.Id == id, ct);
            if (value is null) return Results.NotFound();
            var abbreviation = request.Abbreviation!.Trim().ToUpperInvariant();
            if (await db.ClassificationDefinitions.AnyAsync(x => x.Id != id && x.Abbreviation == abbreviation, ct)) return Results.ValidationProblem(new Dictionary<string, string[]> { ["abbreviation"] = ["Kortformen er allerede i bruk."] });
            value.Update(request.Name!, abbreviation, request.SortOrder, request.IsActive);
            Record(db, context, "classification.updated", "classification-definition", value.Id);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        group.MapDelete("/{id:guid}", async (Guid id, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct) =>
        {
            if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
            var value = await db.ClassificationDefinitions.SingleOrDefaultAsync(candidate => candidate.Id == id, ct);
            if (value is null) return Results.NotFound();
            db.ClassificationDefinitions.Remove(value);
            Record(db, context, "classification.deleted", "classification-definition", value.Id);
            await db.SaveChangesAsync(ct);
            return Results.NoContent();
        });

        return endpoints;
    }

    private static IResult? Validate(SaveDefinition request)
    {
        if ((request.Name?.Trim().Length ?? 0) is < 2 or > 100)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["Navnet må være mellom 2 og 100 tegn."] });
        if ((request.Abbreviation?.Trim().Length ?? 0) is < 1 or > 12)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["abbreviation"] = ["Kortformen må være mellom 1 og 12 tegn."] });
        if (request.SortOrder is < 0 or > 100000)
            return Results.ValidationProblem(new Dictionary<string, string[]> { ["sortOrder"] = ["Rekkefølgen må være mellom 0 og 100000."] });
        return null;
    }

    private static void Record(FylkrenDbContext db, HttpContext context, string eventType, string entityType, Guid entityId)
    {
        if (Guid.TryParse(context.User.FindFirst("fylkren:person_id")?.Value, out var actor)) db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor, eventType, entityType, entityId, DateTimeOffset.UtcNow));
    }

    private sealed record UpdateSettings(bool Enabled);
    private sealed record SaveDefinition(string? Name, string? Abbreviation, int SortOrder, bool IsActive);
}
