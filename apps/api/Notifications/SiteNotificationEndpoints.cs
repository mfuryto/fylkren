using System.Security.Claims;
using Fylkren.Api.ActivityAudit;
using Fylkren.Api.Persistence;
using Microsoft.AspNetCore.Antiforgery;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Notifications;

public static class SiteNotificationEndpoints
{
    public static IEndpointRouteBuilder MapSiteNotificationEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/site-notifications").RequireAuthorization();
        group.MapGet("/sites", GetManagedSites);
        group.MapGet("/sites/{siteId:guid}", GetSiteSettings);
        group.MapPut("/sites/{siteId:guid}", UpdateSiteSettings);
        group.MapGet("/personal", GetPersonalSettings);
        group.MapPut("/personal/{siteId:guid}", UpdatePersonalSettings);
        return endpoints;
    }

    private static async Task<IResult> GetManagedSites(
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var sites = await database.SiteManagerAssignments.AsNoTracking()
            .Where(value => value.PersonId == personId && value.IsActive && value.Site.IsActive)
            .OrderBy(value => value.Site.Name)
            .Select(value => new { value.SiteId, value.Site.Name })
            .ToListAsync(cancellationToken);
        return sites.Count == 0 ? Results.Problem(statusCode: 403) : Results.Ok(sites);
    }

    private static async Task<IResult> GetSiteSettings(
        Guid siteId,
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await CanManage(siteId, user, database, cancellationToken))
            return Results.Problem(statusCode: 403);
        var value = await database.SiteNotificationSettings.AsNoTracking()
            .SingleOrDefaultAsync(settings => settings.SiteId == siteId, cancellationToken);
        return Results.Ok(SettingsResponse.From(value));
    }

    private static async Task<IResult> UpdateSiteSettings(
        Guid siteId,
        UpdateRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) || !await CanManage(siteId, user, database, cancellationToken))
            return Results.Problem(statusCode: 403);

        var value = await database.SiteNotificationSettings
            .SingleOrDefaultAsync(settings => settings.SiteId == siteId, cancellationToken);
        if (value is null)
        {
            value = new SiteNotificationSettings(Guid.NewGuid(), siteId);
            database.Add(value);
        }
        Apply(value, request);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
            "notification-settings.updated", "notification-settings", value.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static async Task<IResult> GetPersonalSettings(
        ClaimsPrincipal user,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
        var sites = await database.SiteMemberships.AsNoTracking()
            .Where(value => value.PersonId == personId && value.IsActive && value.Site.IsActive)
            .OrderBy(value => value.Site.Name)
            .Select(value => new { value.SiteId, value.Site.Name })
            .ToListAsync(cancellationToken);
        var siteIds = sites.Select(site => site.SiteId).ToList();
        var defaults = await database.SiteNotificationSettings.AsNoTracking()
            .Where(value => siteIds.Contains(value.SiteId))
            .ToDictionaryAsync(value => value.SiteId, cancellationToken);
        var personal = await database.PersonalNotificationSettings.AsNoTracking()
            .Where(value => value.PersonId == personId && siteIds.Contains(value.SiteId))
            .ToDictionaryAsync(value => value.SiteId, cancellationToken);

        return Results.Ok(sites.Select(site =>
        {
            defaults.TryGetValue(site.SiteId, out var siteSettings);
            personal.TryGetValue(site.SiteId, out var personalSettings);
            var available = SettingsResponse.From(siteSettings);
            return new
            {
                site.SiteId,
                site.Name,
                newWorkItems = available.NewWorkItems && (personalSettings?.NewWorkItems ?? true),
                workItemChanges = available.WorkItemChanges && (personalSettings?.WorkItemChanges ?? true),
                decisionsRequired = available.DecisionsRequired && (personalSettings?.DecisionsRequired ?? true),
                childWorkCompleted = available.ChildWorkCompleted && (personalSettings?.ChildWorkCompleted ?? true),
                planningCompleted = available.PlanningCompleted && (personalSettings?.PlanningCompleted ?? true),
                executionCompleted = available.ExecutionCompleted && (personalSettings?.ExecutionCompleted ?? true),
                available
            };
        }));
    }

    private static async Task<IResult> UpdatePersonalSettings(
        Guid siteId,
        UpdateRequest request,
        ClaimsPrincipal user,
        IAntiforgery antiforgery,
        HttpContext context,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        if (!await antiforgery.IsRequestValidAsync(context)) return Results.BadRequest();
        if (!PersonId(user, out var personId) ||
            !await database.SiteMemberships.AnyAsync(value =>
                value.SiteId == siteId && value.PersonId == personId &&
                value.IsActive && value.Site.IsActive, cancellationToken))
            return Results.Problem(statusCode: 403);

        var value = await database.PersonalNotificationSettings
            .SingleOrDefaultAsync(settings =>
                settings.SiteId == siteId && settings.PersonId == personId, cancellationToken);
        if (value is null)
        {
            value = new PersonalNotificationSettings(Guid.NewGuid(), siteId, personId);
            database.Add(value);
        }
        Apply(value, request);
        database.AuditEvents.Add(new AuditEvent(Guid.NewGuid(), siteId, personId,
            "personal-notification-settings.updated", "personal-notification-settings",
            value.Id, DateTimeOffset.UtcNow));
        await database.SaveChangesAsync(cancellationToken);
        return Results.NoContent();
    }

    private static void Apply(SiteNotificationSettings value, UpdateRequest request) =>
        value.Update(request.NewWorkItems, request.WorkItemChanges, request.DecisionsRequired,
            request.ChildWorkCompleted, request.PlanningCompleted, request.ExecutionCompleted);

    private static void Apply(PersonalNotificationSettings value, UpdateRequest request) =>
        value.Update(request.NewWorkItems, request.WorkItemChanges, request.DecisionsRequired,
            request.ChildWorkCompleted, request.PlanningCompleted, request.ExecutionCompleted);

    private static bool PersonId(ClaimsPrincipal user, out Guid id) => Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);
    private static async Task<bool> CanManage(Guid siteId, ClaimsPrincipal user, FylkrenDbContext db, CancellationToken ct) => PersonId(user, out var id) && await db.SiteManagerAssignments.AnyAsync(x => x.SiteId == siteId && x.PersonId == id && x.IsActive && x.Site.IsActive, ct);
    private sealed record SettingsResponse(bool NewWorkItems, bool WorkItemChanges, bool DecisionsRequired,
        bool ChildWorkCompleted, bool PlanningCompleted, bool ExecutionCompleted)
    {
        public static SettingsResponse From(SiteNotificationSettings? value) => new(
            value?.NewWorkItems ?? false,
            value?.WorkItemChanges ?? false,
            value?.DecisionsRequired ?? false,
            value?.ChildWorkCompleted ?? false,
            value?.PlanningCompleted ?? false,
            value?.ExecutionCompleted ?? false);
    }
    private sealed record UpdateRequest(bool NewWorkItems, bool WorkItemChanges, bool DecisionsRequired, bool ChildWorkCompleted, bool PlanningCompleted, bool ExecutionCompleted);
}
