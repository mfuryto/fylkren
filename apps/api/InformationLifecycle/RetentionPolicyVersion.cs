namespace Fylkren.Api.InformationLifecycle;

// An explicit rule reference only. No scheduler or irreversible execution is enabled.
public sealed class RetentionPolicyVersion
{
    private RetentionPolicyVersion() { }
    public RetentionPolicyVersion(Guid policyId, int version, string name, string category, int? reviewAfterDays, Guid actorId, DateTimeOffset now)
    {
        if (policyId == Guid.Empty || version < 1 || string.IsNullOrWhiteSpace(name) || name.Length > 200 || name.Any(char.IsControl) ||
            category is not ("content" or "activity" or "security_audit" or "delivery" or "replay" or "backup") || reviewAfterDays is < 1 or > 36500)
            throw new ArgumentException("A named, versioned policy and supported category are required.");
        PolicyId = policyId; Version = version; Name = name.Trim(); Category = category; ReviewAfterDays = reviewAfterDays; CreatedByPersonId = actorId; CreatedAt = now;
    }
    public Guid PolicyId { get; private set; }
    public int Version { get; private set; }
    public string Name { get; private set; } = "";
    public string Category { get; private set; } = "";
    public int? ReviewAfterDays { get; private set; }
    public Guid CreatedByPersonId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
}
