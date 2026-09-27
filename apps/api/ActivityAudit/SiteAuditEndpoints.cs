using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.ActivityAudit;

public static class SiteAuditEndpoints
{
    public static IEndpointRouteBuilder MapSiteAuditEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/site-audit").RequireAuthorization();

        group.MapGet("/sites", async (ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!PersonId(user, out var personId)) return Results.Problem(statusCode: 403);
            if (!await database.SiteManagerAssignments.AnyAsync(value => value.PersonId == personId && value.IsActive && value.Site.IsActive, cancellationToken))
                return Results.Problem(statusCode: 403);
            var sites = await database.SiteManagerAssignments.AsNoTracking()
                .Where(value => value.PersonId == personId && value.IsActive && value.Site.IsActive)
                .OrderBy(value => value.Site.Name)
                .Select(value => new { id = value.SiteId, value.Site.Name })
                .ToListAsync(cancellationToken);
            return Results.Ok(sites);
        });

        group.MapGet("/sites/{siteId:guid}", async (Guid siteId, string? area, string? eventType, DateOnly? from, DateOnly? to, string? search, int? page, ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!PersonId(user, out var personId) || !await database.SiteManagerAssignments.AnyAsync(value => value.SiteId == siteId && value.PersonId == personId && value.IsActive && value.Site.IsActive, cancellationToken))
                return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, search) is { } queryError) return queryError;

            var pageNumber = Math.Max(page ?? 1, 1);
            const int pageSize = 50;
            var query = database.AuditEvents.AsNoTracking().Where(value =>
                value.SiteId == siteId && !value.ActorWasPlatformManager);
            var entityTypes = EntityTypesFor(area);
            if (entityTypes is not null) query = query.Where(value => entityTypes.Contains(value.EntityType));
            if (!string.IsNullOrWhiteSpace(eventType)) query = query.Where(value => value.EventType == eventType.Trim());
            if (from is not null) query = query.Where(value => value.OccurredAt >= new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
            if (to is not null) query = query.Where(value => value.OccurredAt < new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = RequestQueryPolicy.LikePattern(search);
                query = query.Where(value => EF.Functions.ILike(value.EventType, pattern, "\\") || EF.Functions.ILike(value.EntityType, pattern, "\\") || database.People.Any(person => person.Id == value.ActorPersonId && EF.Functions.ILike(person.DisplayName, pattern, "\\")) || value.ActorSiteName != null && EF.Functions.ILike(value.ActorSiteName, pattern, "\\"));
            }

            var total = await query.CountAsync(cancellationToken);
            var eventTypes = await database.AuditEvents.AsNoTracking().Where(value =>
                value.SiteId == siteId && !value.ActorWasPlatformManager)
                .Select(value => value.EventType).Distinct().OrderBy(value => value).ToListAsync(cancellationToken);
            var rawRows = await query.OrderByDescending(value => value.OccurredAt).Skip((pageNumber - 1) * pageSize).Take(pageSize)
                .Select(value => new
                {
                    value.Id,
                    value.OccurredAt,
                    value.EventType,
                    value.EntityType,
                    value.EntityId,
                    actor = database.People.Where(person => person.Id == value.ActorPersonId).Select(person => person.DisplayName).FirstOrDefault() ?? (value.ActorSiteName != null ? "Federert site: " + value.ActorSiteName : "Ukjent bruker")
                }).ToListAsync(cancellationToken);
            var entityIds = rawRows.Select(value => value.EntityId).Distinct().ToList();
            var names = new Dictionary<Guid, string>();
            void AddNames(IEnumerable<KeyValuePair<Guid, string>> values) { foreach (var value in values) names.TryAdd(value.Key, value.Value); }
            AddNames(await database.People.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.DisplayName)).ToListAsync(cancellationToken));
            AddNames(await database.Sites.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.Name)).ToListAsync(cancellationToken));
            AddNames(await database.OrganizationUnits.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.Name)).ToListAsync(cancellationToken));
            AddNames(await database.OrganizationRoles.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.Name)).ToListAsync(cancellationToken));
            AddNames(await database.WorkItems.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.Title)).ToListAsync(cancellationToken));
            AddNames(await database.Decisions.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.Revisions.OrderByDescending(revision => revision.RevisionNumber).Select(revision => revision.Title).First())).ToListAsync(cancellationToken));
            AddNames(await database.WorkflowDefinitions.AsNoTracking().Where(value => entityIds.Contains(value.Id)).Select(value => new KeyValuePair<Guid, string>(value.Id, value.Name)).ToListAsync(cancellationToken));
            var rows = rawRows.Select(value => new { value.Id, value.OccurredAt, value.EventType, value.EntityType, value.EntityId, value.actor, entityName = names.GetValueOrDefault(value.EntityId) }).ToList();
            return Results.Ok(new { events = rows, eventTypes, page = pageNumber, pageSize, total, totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)) });
        });

        return endpoints;
    }

    private static bool PersonId(ClaimsPrincipal user, out Guid personId) => Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out personId);

    private static string[]? EntityTypesFor(string? area) => area switch
    {
        "organization" => ["site", "organization-unit", "site-manager-assignment"],
        "personnel" => ["person", "login-identity", "organization-role", "role-assignment"],
        "workflows" => ["workflow-definition", "workflow-run", "workflow-step", "execution-run", "execution-step", "execution-external-request"],
        "tasks" => ["decision", "work-item", "work-item-dependency", "work-item-type"],
        _ => null
    };
}
