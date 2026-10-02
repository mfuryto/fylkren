using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Fylkren.Api.WorkManagement;

public static class ReferenceSettingsEndpoints
{
    public static IEndpointRouteBuilder MapReferenceSettingsEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/references").RequireAuthorization();
        group.MapGet("/platform", GetPlatform)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapPut("/platform", UpdatePlatform)
            .RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("/sites", GetManagedSites);
        group.MapPut("/sites/{siteId:guid}", UpdateSite);
        return endpoints;
    }

    private static async Task<IResult> GetPlatform(FylkrenDbContext db, CancellationToken ct)
    {
        var settings = await db.PlatformReferenceSettings.AsNoTracking()
            .SingleAsync(value => value.Key == 1, ct);
        var siteRows = await db.SiteReferenceSettings.AsNoTracking()
            .Join(db.Sites.AsNoTracking(), reference => reference.SiteId, site => site.Id,
                (reference, site) => new { reference.SiteId, site.Name, site.IsActive,
                    reference.Prefix, reference.UpdatedAt })
            .OrderBy(value => value.Name)
            .ToListAsync(ct);
        var typeRows = await db.WorkItemTypes.AsNoTracking()
            .OrderByDescending(type => type.CreatedAt)
            .Select(type => new { type.SiteId, type.Name, type.Abbreviation, type.IsActive })
            .ToListAsync(ct);
        var typesBySite = typeRows.ToLookup(type => type.SiteId);
        var sites = siteRows.Select(site => new
        {
            site.SiteId,
            site.Name,
            site.IsActive,
            site.Prefix,
            site.UpdatedAt,
            types = typesBySite[site.SiteId].Select(type => new
                { type.Name, type.Abbreviation, type.IsActive })
        });
        return Results.Ok(new
        {
            settings.MinimumDigits,
            settings.NextNumber,
            preview = ReferenceCodePolicy.Format("TYPE", settings.NextNumber, settings.MinimumDigits),
            settings.UpdatedAt,
            sites
        });
    }

    private static async Task<IResult> UpdatePlatform(UpdatePlatformRequest request,
        ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var actor)) return Results.Problem(statusCode: 403);
        var now = DateTimeOffset.UtcNow;
        var settings = await db.PlatformReferenceSettings.SingleAsync(value => value.Key == 1, ct);
        try { settings.Update(request.MinimumDigits, request.NextNumber, now, actor); }
        catch (ArgumentOutOfRangeException exception)
        {
            return Validation(exception.ParamName == "nextNumber" ? "nextNumber" : "minimumDigits",
                exception.ParamName == "nextNumber" ? "The next number may only be moved forward." : "Choose between 3 and 10 digits.");
        }
        var instanceId = await db.InstanceIdentities.AsNoTracking().Where(value => value.Key == 1)
            .Select(value => value.InstanceId).SingleAsync(ct);
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), null, actor,
            "reference-settings.platform-updated", "instance", instanceId, now));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateConcurrencyException)
        {
            return Results.Conflict(new { error = "reference_sequence_changed", message = "The reference sequence changed while it was being saved. Reload and try again." });
        }
        return Results.Ok(new
        {
            settings.MinimumDigits,
            settings.NextNumber,
            preview = ReferenceCodePolicy.Format("TYPE", settings.NextNumber, settings.MinimumDigits),
            settings.UpdatedAt
        });
    }

    private static async Task<IResult> GetManagedSites(ClaimsPrincipal user,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!PersonId(user, out var actor)) return Results.Problem(statusCode: 403);
        var platform = await db.PlatformReferenceSettings.AsNoTracking()
            .SingleAsync(value => value.Key == 1, ct);
        var sites = await db.SiteManagerAssignments.AsNoTracking()
            .Where(value => value.PersonId == actor && value.IsActive && value.Site.IsActive)
            .Join(db.SiteReferenceSettings.AsNoTracking(), assignment => assignment.SiteId,
                reference => reference.SiteId,
                (assignment, reference) => new { assignment.SiteId, assignment.Site.Name,
                    reference.Prefix, reference.UpdatedAt })
            .OrderBy(value => value.Name)
            .ToListAsync(ct);
        if (sites.Count == 0) return Results.Problem(statusCode: 403);
        return Results.Ok(new { platform.MinimumDigits, platform.NextNumber, sites });
    }

    private static async Task<IResult> UpdateSite(Guid siteId, UpdateSiteRequest request,
        ClaimsPrincipal user, IAntiforgery antiforgery, HttpContext context,
        FylkrenDbContext db, CancellationToken ct)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var actor) || !await db.SiteManagerAssignments.AnyAsync(value =>
            value.SiteId == siteId && value.PersonId == actor && value.IsActive && value.Site.IsActive, ct))
            return Results.Problem(statusCode: 403);
        var settings = await db.SiteReferenceSettings.SingleOrDefaultAsync(value => value.SiteId == siteId, ct);
        if (settings is null) return Results.NotFound();
        try { settings.Update(request.Prefix ?? string.Empty, DateTimeOffset.UtcNow, actor); }
        catch (ArgumentException exception) { return Validation("prefix", exception.Message); }
        db.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, actor,
            "reference-settings.site-updated", "site", siteId, DateTimeOffset.UtcNow));
        try { await db.SaveChangesAsync(ct); }
        catch (DbUpdateException exception) when (exception.InnerException is PostgresException
            { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            return Results.Conflict(new { error = "reference_prefix_in_use" });
        }
        var platform = await db.PlatformReferenceSettings.AsNoTracking()
            .SingleAsync(value => value.Key == 1, ct);
        return Results.Ok(new
        {
            settings.SiteId,
            settings.Prefix,
            preview = ReferenceCodePolicy.Format(settings.Prefix,
                platform.NextNumber, platform.MinimumDigits),
            settings.UpdatedAt
        });
    }

    private static bool PersonId(ClaimsPrincipal user, out Guid id) =>
        Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);

    private static IResult Validation(string key, string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { [key] = [message] });

    private sealed record UpdatePlatformRequest(int MinimumDigits, long NextNumber);
    private sealed record UpdateSiteRequest(string? Prefix);
}
