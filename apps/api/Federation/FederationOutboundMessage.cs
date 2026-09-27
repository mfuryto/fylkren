namespace Fylkren.Api.Federation;

// A durable, unsent message. Delivery is a separate process and must never run
// inside the transaction that records the originating user action.
internal sealed class FederationOutboundMessage
{
    private FederationOutboundMessage() { }

    internal FederationOutboundMessage(Guid messageId, Guid peerInstanceId, Guid sourceSiteId,
        Guid destinationSiteId, Guid originInstanceId, Guid originSiteId, Guid originResourceId,
        string messageType, int schemaVersion, string payloadJson, DateTimeOffset createdAt,
        Guid? correlationId = null, Guid? causationId = null)
    {
        if (messageId == Guid.Empty || peerInstanceId == Guid.Empty || sourceSiteId == Guid.Empty ||
            destinationSiteId == Guid.Empty || originInstanceId == Guid.Empty || originSiteId == Guid.Empty ||
            originResourceId == Guid.Empty || schemaVersion < 1 ||
            string.IsNullOrWhiteSpace(messageType) || messageType.Length > 80 ||
            string.IsNullOrWhiteSpace(payloadJson) || payloadJson.Length > 1_000_000)
            throw new ArgumentException("Federation message envelope is invalid.");
        MessageId = messageId;
        PeerInstanceId = peerInstanceId;
        SourceSiteId = sourceSiteId;
        DestinationSiteId = destinationSiteId;
        OriginInstanceId = originInstanceId;
        OriginSiteId = originSiteId;
        OriginResourceId = originResourceId;
        MessageType = messageType;
        SchemaVersion = schemaVersion;
        PayloadJson = payloadJson;
        CorrelationId = correlationId;
        CausationId = causationId;
        Status = "pending";
        CreatedAt = createdAt;
        NextAttemptAt = createdAt;
    }

    public Guid MessageId { get; private set; }
    public Guid PeerInstanceId { get; private set; }
    public Guid SourceSiteId { get; private set; }
    public Guid DestinationSiteId { get; private set; }
    public Guid OriginInstanceId { get; private set; }
    public Guid OriginSiteId { get; private set; }
    public Guid OriginResourceId { get; private set; }
    public string MessageType { get; private set; } = string.Empty;
    public int SchemaVersion { get; private set; }
    public string PayloadJson { get; private set; } = string.Empty;
    public Guid? CorrelationId { get; private set; }
    public Guid? CausationId { get; private set; }
    public string Status { get; private set; } = string.Empty;
    public int AttemptCount { get; private set; }
    public DateTimeOffset CreatedAt { get; private set; }
    public DateTimeOffset NextAttemptAt { get; private set; }
    public DateTimeOffset? DeliveredAt { get; private set; }
    public string? LastErrorCode { get; private set; }

    internal void RecordRetry(string errorCode, DateTimeOffset nextAttemptAt)
    {
        if (Status is not ("pending" or "retrying") || string.IsNullOrWhiteSpace(errorCode) || errorCode.Length > 80)
            throw new InvalidOperationException("Only an undelivered message can be retried.");
        Status = "retrying";
        LastErrorCode = errorCode;
        NextAttemptAt = nextAttemptAt;
    }

    internal void MarkDelivered(DateTimeOffset at)
    {
        if (Status is not ("pending" or "retrying"))
            throw new InvalidOperationException("Message is no longer pending delivery.");
        Status = "delivered";
        DeliveredAt = at;
        LastErrorCode = null;
    }

    internal void MarkFailed(string errorCode)
    {
        if (Status is not ("pending" or "retrying") || string.IsNullOrWhiteSpace(errorCode) || errorCode.Length > 80)
            throw new InvalidOperationException("Only an undelivered message can fail.");
        Status = "failed";
        LastErrorCode = errorCode;
    }
}
