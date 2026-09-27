namespace Fylkren.Api.Federation;

// Committed in the same transaction as the received work and audit event.
// Message identity is distinct from the work origin address: transport retries
// must return the same counterpart without creating another local work item.
internal sealed class FederationInboundReceipt
{
    private FederationInboundReceipt() { }

    internal FederationInboundReceipt(Guid peerInstanceId, Guid messageId, string messageType,
        Guid sourceSiteId, Guid destinationSiteId, Guid originInstanceId, Guid originSiteId,
        Guid originResourceId, Guid? correlationId, Guid? causationId, string payloadSha256,
        Guid localWorkItemId, DateTimeOffset receivedAt)
    {
        if (peerInstanceId == Guid.Empty || messageId == Guid.Empty || sourceSiteId == Guid.Empty ||
            destinationSiteId == Guid.Empty || originInstanceId == Guid.Empty ||
            originSiteId == Guid.Empty || originResourceId == Guid.Empty || localWorkItemId == Guid.Empty ||
            string.IsNullOrWhiteSpace(messageType) || messageType.Length > 80 ||
            payloadSha256.Length != 64 || !payloadSha256.All(Uri.IsHexDigit))
            throw new ArgumentException("A complete inbound message receipt is required.");
        PeerInstanceId = peerInstanceId;
        MessageId = messageId;
        MessageType = messageType;
        SourceSiteId = sourceSiteId;
        DestinationSiteId = destinationSiteId;
        OriginInstanceId = originInstanceId;
        OriginSiteId = originSiteId;
        OriginResourceId = originResourceId;
        CorrelationId = correlationId;
        CausationId = causationId;
        PayloadSha256 = payloadSha256.ToUpperInvariant();
        LocalWorkItemId = localWorkItemId;
        ReceivedAt = receivedAt;
    }

    public Guid PeerInstanceId { get; private set; }
    public Guid MessageId { get; private set; }
    public string MessageType { get; private set; } = string.Empty;
    public Guid SourceSiteId { get; private set; }
    public Guid DestinationSiteId { get; private set; }
    public Guid OriginInstanceId { get; private set; }
    public Guid OriginSiteId { get; private set; }
    public Guid OriginResourceId { get; private set; }
    public Guid? CorrelationId { get; private set; }
    public Guid? CausationId { get; private set; }
    public string PayloadSha256 { get; private set; } = string.Empty;
    public Guid LocalWorkItemId { get; private set; }
    public DateTimeOffset ReceivedAt { get; private set; }
}
