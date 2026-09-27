namespace Fylkren.Api.Federation;

// Correlates one locally owned work item with its durable origin across installations.
// It does not grant visibility or authorize delivery by itself.
internal sealed class FederationWorkLink
{
    private FederationWorkLink() { }

    internal FederationWorkLink(Guid id, Guid localWorkItemId, Guid peerInstanceId, Guid remoteSiteId,
        Guid originInstanceId, Guid originSiteId, Guid originResourceId, string direction, DateTimeOffset createdAt)
    {
        if (id == Guid.Empty || localWorkItemId == Guid.Empty || peerInstanceId == Guid.Empty ||
            remoteSiteId == Guid.Empty || originInstanceId == Guid.Empty || originSiteId == Guid.Empty ||
            originResourceId == Guid.Empty || direction is not ("incoming" or "outgoing"))
            throw new ArgumentException("Federated work addresses and direction are required.");
        Id = id;
        LocalWorkItemId = localWorkItemId;
        PeerInstanceId = peerInstanceId;
        RemoteSiteId = remoteSiteId;
        OriginInstanceId = originInstanceId;
        OriginSiteId = originSiteId;
        OriginResourceId = originResourceId;
        Direction = direction;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }
    public Guid LocalWorkItemId { get; private set; }
    public Guid PeerInstanceId { get; private set; }
    public Guid RemoteSiteId { get; private set; }
    public Guid OriginInstanceId { get; private set; }
    public Guid OriginSiteId { get; private set; }
    public Guid OriginResourceId { get; private set; }
    public string Direction { get; private set; } = string.Empty;
    public Guid? RemoteWorkItemId { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset? AcknowledgedAt { get; private set; }
    public Guid? OfficialAnswerMessageId { get; private set; }
    public string? OfficialAnswer { get; private set; }
    public string? OfficialAnswerClassification { get; private set; }
    public DateTimeOffset? OfficialAnswerApprovedAt { get; private set; }
    public string? OfficialAnswerSiteName { get; private set; }
    public long RemoteProgressSequence { get; private set; }
    public string? RemoteProgressStatus { get; private set; }
    public DateTimeOffset? RemoteProgressAt { get; private set; }

    internal void Acknowledge(Guid remoteWorkItemId, DateTimeOffset at)
    {
        if (remoteWorkItemId == Guid.Empty) throw new ArgumentException("Remote work item ID is required.", nameof(remoteWorkItemId));
        if (RemoteWorkItemId is Guid existing && existing != remoteWorkItemId)
            throw new InvalidOperationException("A federated counterpart cannot be changed after acknowledgement.");
        RemoteWorkItemId = remoteWorkItemId;
        AcknowledgedAt ??= at;
    }

    internal void RecordOfficialAnswer(Guid messageId, string answer, string? classification,
        DateTimeOffset approvedAt, string sourceSiteName)
    {
        var normalizedClassification = string.IsNullOrWhiteSpace(classification)
            ? null : classification.Trim().ToUpperInvariant();
        if (messageId == Guid.Empty || string.IsNullOrWhiteSpace(answer) || answer.Length > 20_000 ||
            normalizedClassification is { Length: > 20 } ||
            approvedAt == default || string.IsNullOrWhiteSpace(sourceSiteName) || sourceSiteName.Length > 200)
            throw new ArgumentException("An approved official answer is required.");
        if (OfficialAnswerMessageId is Guid existing && existing != messageId)
            throw new InvalidOperationException("An official federated answer is immutable after receipt.");
        if (OfficialAnswerMessageId == messageId &&
            (OfficialAnswer != answer || OfficialAnswerClassification != normalizedClassification ||
             OfficialAnswerApprovedAt != approvedAt ||
             OfficialAnswerSiteName != sourceSiteName))
            throw new InvalidOperationException("An official federated answer cannot be changed in place.");
        OfficialAnswerMessageId = messageId;
        OfficialAnswer = answer;
        OfficialAnswerClassification = normalizedClassification;
        OfficialAnswerApprovedAt = approvedAt;
        OfficialAnswerSiteName = sourceSiteName.Trim();
        RemoteProgressStatus = "answered";
        RemoteProgressAt = approvedAt;
    }

    internal long EmitProgress(string phase, DateTimeOffset at)
    {
        if (Direction != "incoming")
            throw new InvalidOperationException("Only an incoming task can emit progress.");
        ApplyProgress(phase, checked(RemoteProgressSequence + 1), at);
        return RemoteProgressSequence;
    }

    internal bool ApplyProgress(string phase, long sequence, DateTimeOffset at)
    {
        if (phase is not ("under_review" or "assigned" or "in_progress") ||
            sequence < 1 || at == default)
            throw new ArgumentException("Invalid federated progress.");
        if (OfficialAnswerMessageId is not null || sequence < RemoteProgressSequence)
            return false;
        if (sequence == RemoteProgressSequence)
        {
            if (RemoteProgressStatus != phase)
                throw new InvalidOperationException("Conflicting federated progress sequence.");
            return false;
        }
        RemoteProgressSequence = sequence;
        RemoteProgressStatus = phase;
        RemoteProgressAt = at;
        return true;
    }
}
