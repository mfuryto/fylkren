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

        group.MapGet("/sites/{siteId:guid}", async (Guid siteId, string? area, string? eventType, DateOnly? from, DateOnly? to, string? search, string? sort, int? page, ClaimsPrincipal user, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (!PersonId(user, out var personId) || !await database.SiteManagerAssignments.AnyAsync(value => value.SiteId == siteId && value.PersonId == personId && value.IsActive && value.Site.IsActive, cancellationToken))
                return Results.Problem(statusCode: 403);
            if (RequestQueryPolicy.Validate(page, search) is { } queryError) return queryError;
            if (RequestQueryPolicy.ValidateChoice("area", area, "organization", "personnel", "workflows", "tasks") is { } areaError) return areaError;
            if (RequestQueryPolicy.ValidateMaximumLength("eventType", eventType, 100) is { } eventTypeError) return eventTypeError;
            if (RequestQueryPolicy.ValidateChoice("sort", sort, "newest", "oldest") is { } sortError) return sortError;
            if (from > to) return Results.ValidationProblem(new Dictionary<string, string[]> { ["period"] = ["The start date cannot be after the end date."] });

            var pageNumber = Math.Max(page ?? 1, 1);
            const int pageSize = 50;
            var query = database.AuditEvents.AsNoTracking().Where(value =>
                value.SiteId == siteId && !value.ActorWasPlatformManager);
            var entityTypes = EntityTypesFor(area);
            if (entityTypes is not null) query = query.Where(value => entityTypes.Contains(value.EntityType));
            if (!string.IsNullOrWhiteSpace(eventType)) query = query.Where(value => value.EventType == eventType.Trim());
            if (from is not null) query = query.Where(value => value.OccurredAt >= new DateTimeOffset(from.Value.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
            if (to is not null && to.Value < DateOnly.MaxValue) query = query.Where(value => value.OccurredAt < new DateTimeOffset(to.Value.AddDays(1).ToDateTime(TimeOnly.MinValue), TimeSpan.Zero));
            var contextual = query.Select(value => new
            {
                Event = value,
                WorkItemId = value.EntityType == "work-item" ? (Guid?)value.EntityId :
                    value.EntityType == "workflow-run" ? database.WorkflowRuns.Where(run => run.Id == value.EntityId && run.WorkItem.SiteId == siteId).Select(run => (Guid?)run.WorkItemId).FirstOrDefault() :
                    value.EntityType == "execution-run" ? database.ExecutionRuns.Where(run => run.Id == value.EntityId && run.WorkItem.SiteId == siteId).Select(run => (Guid?)run.WorkItemId).FirstOrDefault() :
                    value.EntityType == "execution-external-request" ? database.ExecutionExternalRequests.Where(request => request.Id == value.EntityId && request.Run.WorkItem.SiteId == siteId).Select(request => (Guid?)request.Run.WorkItemId).FirstOrDefault() :
                    value.EntityType == "work-item-dependency" ? database.WorkItemDependencies.Where(dependency => dependency.Id == value.EntityId && dependency.DependentWorkItem.SiteId == siteId).Select(dependency => (Guid?)dependency.DependentWorkItemId).FirstOrDefault() : null
            });
            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = RequestQueryPolicy.LikePattern(search);
                contextual = contextual.Where(value => EF.Functions.ILike(value.Event.EventType, pattern, "\\") ||
                    EF.Functions.ILike(value.Event.EntityType, pattern, "\\") ||
                    database.People.Any(person => person.Id == value.Event.ActorPersonId && EF.Functions.ILike(person.DisplayName, pattern, "\\")) ||
                    value.Event.ActorSiteName != null && EF.Functions.ILike(value.Event.ActorSiteName, pattern, "\\") ||
                    database.WorkItems.Any(item => item.Id == value.WorkItemId && item.SiteId == siteId &&
                        (EF.Functions.ILike(item.ReferenceCode, pattern, "\\") || EF.Functions.ILike(item.Title, pattern, "\\"))));
                query = contextual.Select(value => value.Event);
            }
            var total = await query.LongCountAsync(cancellationToken);
            var eventTypes = await database.AuditEvents.AsNoTracking().Where(value =>
                value.SiteId == siteId && !value.ActorWasPlatformManager)
                .Select(value => value.EventType).Distinct().OrderBy(value => value).ToListAsync(cancellationToken);
            var ordered = sort == "oldest"
                ? query.OrderBy(value => value.OccurredAt).ThenBy(value => value.Id)
                : query.OrderByDescending(value => value.OccurredAt).ThenBy(value => value.Id);
            var rawRows = await ordered.Skip((pageNumber - 1) * pageSize).Take(pageSize)
                .Select(value => new
                {
                    value.Id,
                    value.DomainEventId,
                    value.OccurredAt,
                    value.EventType,
                    value.EntityType,
                    value.EntityId,
                    actor = database.People.Where(person => person.Id == value.ActorPersonId).Select(person => person.DisplayName).FirstOrDefault() ?? (value.ActorSystem != null ? "System" : value.ActorSiteName != null ? "Federated site: " + value.ActorSiteName : "Unknown user")
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
            var contextRows = await contextual.Where(value => entityIds.Contains(value.Event.EntityId))
                .Select(value => new { value.Event.Id, work = database.WorkItems.Where(item => item.Id == value.WorkItemId && item.SiteId == siteId)
                    .Select(item => new { item.ReferenceCode, item.Title }).FirstOrDefault() }).ToListAsync(cancellationToken);
            var workContext = contextRows.ToDictionary(value => value.Id, value => value.work);
            var factIds = rawRows.Where(x => x.EntityType == "execution-run" && x.DomainEventId != null).Select(x => x.DomainEventId!.Value).ToArray();
            var metadata = await database.DomainEvents.AsNoTracking().Where(x => x.SiteId == siteId && factIds.Contains(x.Id) && x.ResourceType == "execution")
                .Select(x => new { x.Id, x.ActivityMetadataJson }).ToDictionaryAsync(x => x.Id, x => x.ActivityMetadataJson, cancellationToken);
            var rows = rawRows.Select(value => {
                var step = Fylkren.Api.DomainEvents.ExecutionActivityDetails.Read(value.DomainEventId is Guid id ? metadata.GetValueOrDefault(id) : null);
                return new { value.Id, value.OccurredAt, value.EventType, value.EntityType, value.EntityId, value.actor, entityName = names.GetValueOrDefault(value.EntityId), workReference = workContext.GetValueOrDefault(value.Id)?.ReferenceCode, workTitle = workContext.GetValueOrDefault(value.Id)?.Title, step.StepNumber, step.StepName };
            }).ToList();
            return Results.Ok(new { events = rows, eventTypes, page = pageNumber, pageSize, total, totalPages = Math.Max(1L, NumericBounds.Pages(total, pageSize)) });
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
