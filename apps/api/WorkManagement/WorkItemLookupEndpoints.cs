using System.Globalization;
using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemLookupEndpoints
{
    private static readonly StringComparer NameComparer = StringComparer.Create(CultureInfo.GetCultureInfo("en-US"), ignoreCase: true);

    internal static void Map(RouteGroupBuilder group)
    {
        group.MapGet("/sites/{siteId:guid}/types", ListTypes);
        group.MapPost("/sites/{siteId:guid}/types", CreateType);
        group.MapPut("/sites/{siteId:guid}/types/{typeId:guid}", UpdateType);
        group.MapGet("/sites/{siteId:guid}/lookups/{kind}", ListLookups);
        group.MapPost("/sites/{siteId:guid}/lookups/{kind}", CreateLookup);
        group.MapPut("/sites/{siteId:guid}/lookups/{kind}/{id:guid}", UpdateLookup);
    }

    private static async Task<IResult> ListTypes(Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var personId) || !await IsMember(siteId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var values = await db.WorkItemTypes.AsNoTracking()
            .Where(type => type.SiteId == siteId)
            .OrderByDescending(type => type.CreatedAt)
            .ThenByDescending(type => type.Id)
            .Select(type => new { type.Id, type.Name, type.Abbreviation, type.IsActive, type.IsSystemManaged, inUse = type.WorkItems.Any() })
            .ToListAsync(ct);
        return Results.Ok(values);
    }

    private static async Task<IResult> CreateType(Guid siteId, TypeRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) || !await IsSiteManager(siteId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var name = NormalizeName(request.Name);
        if (!ValidName(name) || await db.WorkItemTypes.AnyAsync(type =>
                type.SiteId == siteId && type.NormalizedName == name.ToUpperInvariant(), ct))
            return InvalidName();
        string abbreviation;
        try { abbreviation = ReferenceCodePolicy.NormalizeCode(request.Abbreviation, 2, 12); }
        catch (ArgumentException exception) { return InvalidAbbreviation(exception.Message); }
        if (await db.WorkItemTypes.AnyAsync(value => value.SiteId == siteId && value.Abbreviation == abbreviation, ct))
            return InvalidAbbreviation("The abbreviation must be unique within the Site.");
        var type = new WorkItemType(Guid.NewGuid(), siteId, name, abbreviation, DateTimeOffset.UtcNow);
        db.WorkItemTypes.Add(type);
        AddAudit(db, siteId, personId, "work-item-type.created", "work-item-type", type.Id);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/sites/{siteId}/types/{type.Id}", new { type.Id });
    }

    private static async Task<IResult> UpdateType(Guid siteId, Guid typeId, TypeRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) || !await IsSiteManager(siteId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var type = await db.WorkItemTypes.SingleOrDefaultAsync(value => value.Id == typeId && value.SiteId == siteId, ct);
        if (type is null) return Results.NotFound();
        if (type.IsSystemManaged && !request.IsActive)
            return Results.Conflict(new { error = "System-managed task types cannot be disabled." });
        var name = NormalizeName(request.Name);
        if (!ValidName(name) || await db.WorkItemTypes.AnyAsync(value =>
                value.SiteId == siteId && value.Id != typeId && value.NormalizedName == name.ToUpperInvariant(), ct))
            return InvalidName();
        string abbreviation;
        try { abbreviation = ReferenceCodePolicy.NormalizeCode(request.Abbreviation, 2, 12); }
        catch (ArgumentException exception) { return InvalidAbbreviation(exception.Message); }
        if (await db.WorkItemTypes.AnyAsync(value => value.SiteId == siteId && value.Id != typeId && value.Abbreviation == abbreviation, ct))
            return InvalidAbbreviation("The abbreviation must be unique within the Site.");
        type.Update(name, abbreviation);
        SetActive(type, request.IsActive);
        AddAudit(db, siteId, personId, "work-item-type.updated", "work-item-type", type.Id);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> ListLookups(Guid siteId, string kind, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct)
    {
        if (!LookupKind(kind) || !PersonId(user, out var personId) || !await IsMember(siteId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var values = await db.WorkItemLookups.AsNoTracking()
            .Where(value => value.SiteId == siteId && value.Kind == kind)
            .Select(value => new
            {
                value.Id,
                value.Name,
                value.IsActive,
                inUse = db.WorkItems.Any(item => item.SourceTypeId == value.Id || item.SenderId == value.Id)
            })
            .ToListAsync(ct);
        return Results.Ok(values.OrderBy(value => value.Name, NameComparer).ThenBy(value => value.Id));
    }

    private static async Task<IResult> CreateLookup(Guid siteId, string kind, TypeRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!LookupKind(kind) || !PersonId(user, out var personId) || !await IsSiteManager(siteId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var name = NormalizeName(request.Name);
        if (!ValidName(name) || await db.WorkItemLookups.AnyAsync(value =>
                value.SiteId == siteId && value.Kind == kind && value.NormalizedName == name.ToUpperInvariant(), ct))
            return InvalidName();
        var value = new WorkItemLookup(Guid.NewGuid(), siteId, kind, name, DateTimeOffset.UtcNow);
        db.Add(value);
        AddAudit(db, siteId, personId, $"work-item-{kind}.created", "work-item-lookup", value.Id);
        await db.SaveChangesAsync(ct);
        return Results.Created($"/api/work/sites/{siteId}/lookups/{kind}/{value.Id}", new { value.Id });
    }

    private static async Task<IResult> UpdateLookup(Guid siteId, string kind, Guid id, TypeRequest request, ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context, FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!LookupKind(kind) || !PersonId(user, out var personId) || !await IsSiteManager(siteId, personId, db, ct))
            return Results.Problem(statusCode: 403);
        var value = await db.WorkItemLookups.SingleOrDefaultAsync(lookup =>
            lookup.Id == id && lookup.SiteId == siteId && lookup.Kind == kind, ct);
        if (value is null) return Results.NotFound();
        var name = NormalizeName(request.Name);
        if (!ValidName(name) || await db.WorkItemLookups.AnyAsync(lookup =>
                lookup.Id != id && lookup.SiteId == siteId && lookup.Kind == kind &&
                lookup.NormalizedName == name.ToUpperInvariant(), ct))
            return InvalidName();
        value.Update(name);
        SetActive(value, request.IsActive);
        AddAudit(db, siteId, personId, $"work-item-{kind}.updated", "work-item-lookup", value.Id);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static void AddAudit(FylkrenDbContext db, Guid siteId, Guid personId, string action, string targetType, Guid targetId) =>
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId, action, targetType, targetId, DateTimeOffset.UtcNow));

    private static void SetActive(WorkItemType value, bool active) { if (active) value.Activate(); else value.Deactivate(); }
    private static void SetActive(WorkItemLookup value, bool active) { if (active) value.Activate(); else value.Deactivate(); }
    private static bool PersonId(ClaimsPrincipal user, out Guid id) => Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);
    private static Task<bool> IsMember(Guid siteId, Guid personId, FylkrenDbContext db, CancellationToken ct) => WorkLevelAuthorization.IsSiteMember(siteId, personId, db, ct);
    private static Task<bool> IsSiteManager(Guid siteId, Guid personId, FylkrenDbContext db, CancellationToken ct) =>
        db.SiteManagerAssignments.AnyAsync(assignment => assignment.SiteId == siteId && assignment.PersonId == personId && assignment.IsActive && assignment.Site.IsActive && assignment.Person.IsActive, ct);
    private static string NormalizeName(string? name) => (name ?? "").Trim();
    private static bool ValidName(string name) => name.Length is >= 2 and <= 100;
    private static IResult InvalidName() => Results.ValidationProblem(new Dictionary<string, string[]> { ["name"] = ["The name must be unique and between 2 and 100 characters."] });
    private static IResult InvalidAbbreviation(string message) => Results.ValidationProblem(new Dictionary<string, string[]> { ["abbreviation"] = [message] });
    private static bool LookupKind(string kind) => kind is "source-type" or "sender";

    private sealed record TypeRequest(string? Name, string? Abbreviation = null, bool IsActive = true);
}
