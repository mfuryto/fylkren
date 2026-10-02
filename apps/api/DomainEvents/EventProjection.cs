namespace Fylkren.Api.DomainEvents;

public sealed class EventProjection
{
    private EventProjection() { }
    public EventProjection(string consumer, Guid eventId, DateTimeOffset now)
    {
        if (consumer is not ("notifications" or "webhooks") || eventId == Guid.Empty) throw new ArgumentException("Unknown event consumer.");
        Consumer = consumer; DomainEventId = eventId; NextAttemptAt = now;
    }
    public string Consumer { get; private set; } = "";
    public Guid DomainEventId { get; private set; }
    public string Status { get; private set; } = "pending";
    public Guid? LeaseOwner { get; private set; }
    public DateTimeOffset? LeaseExpiresAt { get; private set; }
    public int AttemptCount { get; private set; }
    public DateTimeOffset NextAttemptAt { get; private set; }
    public string? LastError { get; private set; }
    public DateTimeOffset? CompletedAt { get; private set; }
    public void Claim(Guid owner, DateTimeOffset now)
    {
        if (owner == Guid.Empty || Status is "completed" or "skipped" || NextAttemptAt > now || LeaseExpiresAt > now)
            throw new InvalidOperationException("Projection is not claimable.");
        Status = "processing"; LeaseOwner = owner; LeaseExpiresAt = now.AddMinutes(5); AttemptCount++;
    }
    public void Complete(Guid owner, DateTimeOffset now, bool skipped = false)
    {
        if (LeaseOwner != owner || Status != "processing" || LeaseExpiresAt <= now) throw new InvalidOperationException("Projection lease is not valid.");
        Status = skipped ? "skipped" : "completed"; CompletedAt = now; LeaseOwner = null; LeaseExpiresAt = null; LastError = null;
    }
    public void Fail(Guid owner, DateTimeOffset now, string reason)
    {
        if (LeaseOwner != owner || Status != "processing") throw new InvalidOperationException("Projection lease is not owned.");
        Status = "pending"; LeaseOwner = null; LeaseExpiresAt = null; NextAttemptAt = now.AddMinutes(Math.Min(60, AttemptCount));
        LastError = reason.Length > 300 ? reason[..300] : reason;
    }
}
