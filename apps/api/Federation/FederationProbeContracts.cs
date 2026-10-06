namespace Fylkren.Api.Federation;

internal sealed record FederationProbeRequest(Guid SenderInstanceId, Guid RecipientInstanceId,
    long Timestamp, Guid Nonce, string? Signature, string? SignatureAlgorithm = null);

internal sealed record FederationProbeResponse(Guid SenderInstanceId, Guid RecipientInstanceId,
    long Timestamp, Guid Nonce, string Signature, string? SignatureAlgorithm = null);
