using System.Globalization;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationIdentityDiscoveryRequest(Guid RequesterInstanceId, Guid Nonce,
    int MaximumProtocolVersion = 1);

internal sealed record FederationIdentityDiscoveryResponse(Guid InstanceId,
    Guid RequesterInstanceId, long Timestamp, Guid Nonce, string PublicKeySpki,
    string Signature, string? SignatureAlgorithm = null);

internal static class FederationIdentityDiscoveryProtocol
{
    internal static byte[] ResponseBytes(Guid instanceId, Guid requesterInstanceId,
        long timestamp, Guid nonce, string fingerprint, string? signatureAlgorithm = null) =>
        Encoding.ASCII.GetBytes(string.Join('\n', new[]
        {
            FederationSignatureProtocol.Purpose("fylkren-federation-identity-discovery-v1", signatureAlgorithm),
            instanceId.ToString("N"), requesterInstanceId.ToString("N"),
            timestamp.ToString(CultureInfo.InvariantCulture), nonce.ToString("N"),
            fingerprint
        }.Concat(FederationSignatureProtocol.Bind(signatureAlgorithm))));
}
