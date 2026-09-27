using System.Text.Json;
using Fylkren.Api.Persistence;

namespace Fylkren.Api.DomainEvents;

internal static class DomainEventRecorder
{
    internal static DomainEvent Record(FylkrenDbContext db, string eventType, Guid siteId, Guid? actorPersonId, string resourceType, Guid resourceId, object? payload, DateTimeOffset now)
    {
        var value = new DomainEvent(Guid.NewGuid(), eventType, 1, now, siteId, actorPersonId, resourceType, resourceId, JsonSerializer.Serialize(payload ?? new { }));
        db.DomainEvents.Add(value);
        return value;
    }
}
