namespace Fylkren.Api.Federation;

// Durable replay guard shared by all API replicas of one installation.
internal sealed class FederationProbeNonce
{
    private FederationProbeNonce() { }

    internal FederationProbeNonce(Guid peerInstanceId, Guid nonce, DateTimeOffset receivedAt)
    {
        PeerInstanceId = peerInstanceId;
        Nonce = nonce;
        ReceivedAt = receivedAt;
    }

    public Guid PeerInstanceId { get; private set; }
    public Guid Nonce { get; private set; }
    public DateTimeOffset ReceivedAt { get; private set; }
}
