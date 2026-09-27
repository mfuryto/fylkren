namespace Fylkren.Api.Federation;

internal sealed class FederationRoutingSettings
{
    internal const int SingletonKey = 1;

    private FederationRoutingSettings() { }

    internal FederationRoutingSettings(bool enabled, Guid? changedBy, DateTimeOffset changedAt)
    {
        Key = SingletonKey;
        Enabled = enabled;
        ChangedBy = changedBy;
        ChangedAt = changedAt;
    }

    public int Key { get; private set; }
    public bool Enabled { get; private set; }
    public Guid? ChangedBy { get; private set; }
    public DateTimeOffset ChangedAt { get; private set; }

    internal void SetEnabled(bool enabled, Guid actor, DateTimeOffset at)
    {
        Enabled = enabled;
        ChangedBy = actor;
        ChangedAt = at;
    }
}
