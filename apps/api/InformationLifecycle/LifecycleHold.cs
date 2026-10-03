namespace Fylkren.Api.InformationLifecycle;

public sealed class LifecycleHold
{
    private LifecycleHold() { }
    public LifecycleHold(Guid id, Guid lifecycleId, Guid actorId, string reason, DateTimeOffset now)
    {
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 1000 || reason.Any(char.IsControl)) throw new ArgumentException("A bounded hold reason is required.");
        Id = id; LifecycleId = lifecycleId; CreatedByPersonId = actorId; Reason = reason.Trim(); CreatedAt = now;
    }
    public Guid Id { get; private set; }
    public Guid LifecycleId { get; private set; }
    public Guid CreatedByPersonId { get; private set; }
    public string Reason { get; private set; } = "";
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? ReleasedAt { get; private set; }
    public Guid? ReleasedByPersonId { get; private set; }
    public string? ReleaseReason { get; private set; }
    public void Release(Guid actorId, string reason, DateTimeOffset now)
    {
        if (ReleasedAt is not null || string.IsNullOrWhiteSpace(reason) || reason.Length > 1000 || reason.Any(char.IsControl)) throw new InvalidOperationException("An active hold and bounded release reason are required.");
        ReleasedAt = now; ReleasedByPersonId = actorId; ReleaseReason = reason.Trim();
    }
}
