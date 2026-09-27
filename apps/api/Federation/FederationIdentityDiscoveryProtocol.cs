using System.Globalization;
using System.Text;

namespace Fylkren.Api.Federation;

internal sealed record FederationIdentityDiscoveryRequest(Guid RequesterInstanceId, Guid Nonce);

internal sealed record FederationIdentityDiscoveryResponse(Guid InstanceId,
    Guid RequesterInstanceId, long Timestamp, Guid Nonce, string PublicKeySpki,
    string Signature);

internal static class FederationIdentityDiscoveryProtocol
{
    internal static byte[] ResponseBytes(Guid instanceId, Guid requesterInstanceId,
        long timestamp, Guid nonce, string fingerprint) => Encoding.ASCII.GetBytes(
        string.Join('\n', "fylkren-federation-identity-discovery-v1",
            instanceId.ToString("N"), requesterInstanceId.ToString("N"),
            timestamp.ToString(CultureInfo.InvariantCulture), nonce.ToString("N"),
            fingerprint));
}
