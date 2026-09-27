using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.ActivityAudit;

public static class PlatformAuditEndpoints
{
    public static IEndpointRouteBuilder MapPlatformAuditEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/platform-audit").RequireAuthorization(policy => policy.RequireRole("PlatformManager"));
        group.MapGet("", async (string? eventType, string? search, int? page, FylkrenDbContext database, CancellationToken cancellationToken) =>
        {
            if (RequestQueryPolicy.Validate(page, search) is { } queryError) return queryError;
            var pageNumber = Math.Max(page ?? 1, 1);
            const int pageSize = 50;
            var personEvents = database.AuditEvents.AsNoTracking()
                .Where(value => value.ActorWasPlatformManager ||
                    (value.ActorInstanceId != null && value.SiteId == null));
            var machineEvents = database.ApiMachineAuditEvents.AsNoTracking();
            if (!string.IsNullOrWhiteSpace(eventType))
            {
                var selectedType = eventType.Trim();
                personEvents = personEvents.Where(value => value.EventType == selectedType);
                machineEvents = machineEvents.Where(value => value.EventType == selectedType);
            }
            if (!string.IsNullOrWhiteSpace(search))
            {
                var pattern = RequestQueryPolicy.LikePattern(search);
                personEvents = personEvents.Where(value => EF.Functions.ILike(value.EventType, pattern, "\\") || EF.Functions.ILike(value.EntityType, pattern, "\\") || database.People.Any(person => person.Id == value.ActorPersonId && EF.Functions.ILike(person.DisplayName, pattern, "\\")) || value.SiteId != null && database.Sites.Any(site => site.Id == value.SiteId && EF.Functions.ILike(site.Name, pattern, "\\")));
                machineEvents = machineEvents.Where(value => EF.Functions.ILike(value.EventType, pattern, "\\") || EF.Functions.ILike(value.EntityType, pattern, "\\") || EF.Functions.ILike(value.MachineIdentity.Name, pattern, "\\") || value.SiteId != null && database.Sites.Any(site => site.Id == value.SiteId && EF.Functions.ILike(site.Name, pattern, "\\")));
            }
            var personTotal = await personEvents.CountAsync(cancellationToken);
            var machineTotal = await machineEvents.CountAsync(cancellationToken);
            var total = personTotal + machineTotal;
            var personTypes = await database.AuditEvents.AsNoTracking()
                .Where(value => value.ActorWasPlatformManager ||
                    (value.ActorInstanceId != null && value.SiteId == null))
                .Select(value => value.EventType).Distinct().ToListAsync(cancellationToken);
            var machineTypes = await database.ApiMachineAuditEvents.AsNoTracking().Select(value => value.EventType).Distinct().ToListAsync(cancellationToken);
            var eventTypes = personTypes.Concat(machineTypes).Distinct(StringComparer.Ordinal).OrderBy(value => value, StringComparer.Ordinal).ToArray();
            var personRows = personEvents.Select(value => new
            {
                value.Id,
                value.OccurredAt,
                value.EventType,
                value.EntityType,
                value.EntityId,
                ActorPersonId = (Guid?)value.ActorPersonId,
                ActorInstanceId = (Guid?)value.ActorInstanceId,
                MachineIdentityId = (Guid?)null,
                value.SiteId,
                CorrelationId = (string?)null,
            });
            var machineRows = machineEvents.Select(value => new
            {
                value.Id,
                value.OccurredAt,
                value.EventType,
                value.EntityType,
                value.EntityId,
                ActorPersonId = (Guid?)null,
                ActorInstanceId = (Guid?)null,
                MachineIdentityId = (Guid?)value.MachineIdentityId,
                value.SiteId,
                CorrelationId = (string?)value.CorrelationId,
            });
            var pageOffset = (pageNumber - 1) * pageSize;
            var candidateCount = pageOffset + pageSize;
            var personCandidates = await personRows
                .OrderByDescending(value => value.OccurredAt)
                .ThenBy(value => value.Id)
                .Take(candidateCount)
                .ToArrayAsync(cancellationToken);
            var machineCandidates = await machineRows
                .OrderByDescending(value => value.OccurredAt)
                .ThenBy(value => value.Id)
                .Take(candidateCount)
                .ToArrayAsync(cancellationToken);
            var rawRows = personCandidates.Concat(machineCandidates)
                .OrderByDescending(value => value.OccurredAt)
                .ThenBy(value => value.Id)
                .Skip(pageOffset)
                .Take(pageSize)
                .ToArray();
            var personIds = rawRows.Where(value => value.ActorPersonId != null)
                .Select(value => value.ActorPersonId!.Value).Distinct().ToArray();
            var machineIds = rawRows.Where(value => value.MachineIdentityId != null)
                .Select(value => value.MachineIdentityId!.Value).Distinct().ToArray();
            var siteIds = rawRows.Where(value => value.SiteId != null)
                .Select(value => value.SiteId!.Value).Distinct().ToArray();
            var people = await database.People.AsNoTracking()
                .Where(value => personIds.Contains(value.Id))
                .ToDictionaryAsync(value => value.Id, value => value.DisplayName, cancellationToken);
            var machines = await database.ApiMachineIdentities.AsNoTracking()
                .Where(value => machineIds.Contains(value.Id))
                .ToDictionaryAsync(value => value.Id, value => value.Name, cancellationToken);
            var sites = await database.Sites.AsNoTracking()
                .Where(value => siteIds.Contains(value.Id))
                .ToDictionaryAsync(value => value.Id, value => value.Name, cancellationToken);
            var rows = rawRows.Select(value => new PlatformAuditRow(
                value.Id,
                value.OccurredAt,
                value.EventType,
                value.EntityType,
                value.EntityId,
                value.ActorPersonId is Guid personId
                    ? people.GetValueOrDefault(personId, "Ukjent bruker")
                    : value.ActorInstanceId is Guid instanceId
                        ? $"Federert instans: {instanceId}"
                    : value.MachineIdentityId is Guid machineId
                        ? $"API: {machines.GetValueOrDefault(machineId, "Ukjent klient")}"
                        : "Ukjent aktør",
                value.SiteId is Guid siteId ? sites.GetValueOrDefault(siteId) : null,
                value.CorrelationId)).ToArray();
            return Results.Ok(new { events = rows, eventTypes, page = pageNumber, pageSize, total, totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)pageSize)) });
        });
        return endpoints;
    }

    private sealed record PlatformAuditRow(Guid Id, DateTimeOffset OccurredAt, string EventType, string EntityType, Guid EntityId, string Actor, string? SiteName, string? CorrelationId);
}
