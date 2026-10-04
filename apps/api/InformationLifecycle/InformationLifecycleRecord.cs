namespace Fylkren.Api.InformationLifecycle;

public sealed class InformationLifecycleRecord
{
    private InformationLifecycleRecord() { }
    public InformationLifecycleRecord(Guid id, Guid? ownerSiteId, string resourceType, Guid resourceId, Guid? contextWorkItemId, DateTimeOffset now)
    {
        if (id == Guid.Empty || ownerSiteId == Guid.Empty || resourceId == Guid.Empty || resourceType.Length is < 1 or > 80 ||
            ownerSiteId is null && contextWorkItemId is not null) throw new ArgumentException("A valid lifecycle owner/resource is required.");
        Id = id; OwnerSiteId = ownerSiteId; ResourceType = resourceType; ResourceId = resourceId; ContextWorkItemId = contextWorkItemId; ChangedAt = now;
    }
    public Guid Id { get; private set; }
    public Guid? OwnerSiteId { get; private set; }
    public string ResourceType { get; private set; } = "";
    public Guid ResourceId { get; private set; }
    public Guid? ContextWorkItemId { get; private set; }
    public string Stage { get; private set; } = "active";
    public long Version { get; private set; } = 1;
    public DateTimeOffset ChangedAt { get; private set; }
    public DateTimeOffset? ClosedAt { get; private set; }
    public DateTimeOffset? ArchivedAt { get; private set; }
    public Guid? PolicyId { get; private set; }
    public int? PolicyVersion { get; private set; }
    public DateTimeOffset? EligibleAt { get; private set; }
    public Guid? ExportId { get; private set; }
    public bool IsHeld { get; private set; }
    public bool AutomationPaused { get; private set; }
    public void SetAutomationPaused(bool paused) { if (AutomationPaused != paused) { AutomationPaused = paused; Version++; } }
    public string Reason { get; private set; } = "";
    public void Transition(string next, long expectedVersion, string reason, DateTimeOffset now)
    {
        if (expectedVersion != Version || IsHeld) throw new InvalidOperationException("Lifecycle version/hold prevents this transition.");
        if ((Stage, next) is not (("active", "closed") or ("closed", "active") or ("closed", "archived") or ("archived", "closed")))
            throw new InvalidOperationException("Only reversible closure/archive transitions are enabled.");
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 1000 || reason.Any(char.IsControl)) throw new ArgumentException("A bounded lifecycle reason is required.");
        Stage = next; ChangedAt = now; Version++; Reason = reason.Trim();
        if (next == "closed") ClosedAt = now;
        if (next == "archived") ArchivedAt = now;
    }
    public void BindPolicy(Guid policyId, int policyVersion, long expectedVersion, string reason, DateTimeOffset now)
    {
        if (expectedVersion != Version || policyId == Guid.Empty || policyVersion < 1 || string.IsNullOrWhiteSpace(reason) || reason.Length > 1000 || reason.Any(char.IsControl))
            throw new InvalidOperationException("A current version, policy and bounded reason are required.");
        PolicyId = policyId; PolicyVersion = policyVersion; EligibleAt = null; Reason = reason.Trim(); ChangedAt = now; Version++;
    }
    public void SetHold(bool held, long expectedVersion, string reason, DateTimeOffset now)
    {
        if (expectedVersion != Version || string.IsNullOrWhiteSpace(reason) || reason.Length > 1000 || reason.Any(char.IsControl))
            throw new InvalidOperationException("A current version and bounded hold reason are required.");
        IsHeld = held; Reason = reason.Trim(); ChangedAt = now; Version++;
    }
}
