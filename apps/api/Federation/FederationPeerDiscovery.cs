using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;

namespace Fylkren.Api.Federation;

internal sealed record DiscoveredFederationPeer(Guid InstanceId,
    string PublicKeySpki, string Fingerprint, DateTimeOffset ProvedAt);

internal static class FederationPeerDiscovery
{
    internal static async Task<DiscoveredFederationPeer?> Fetch(string baseUrl,
        Guid localId, IHttpClientFactory clients, CancellationToken ct)
    {
        var nonce = Guid.NewGuid();
        var target = new Uri(new Uri(baseUrl + "/"),
            "api/federation/v1/identity/discover");
        try
        {
            using var request = new HttpRequestMessage(HttpMethod.Post, target)
            {
                Content = JsonContent.Create(new FederationIdentityDiscoveryRequest(localId, nonce))
            };
            using var response = await clients.CreateClient("federation-probe")
                .SendAsync(request, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode) return null;
            await response.Content.LoadIntoBufferAsync(16_384, ct);
            var discovered = await response.Content
                .ReadFromJsonAsync<FederationIdentityDiscoveryResponse>(cancellationToken: ct);
            var now = DateTimeOffset.UtcNow;
            var nowSeconds = now.ToUnixTimeSeconds();
            if (discovered is null || discovered.InstanceId == Guid.Empty ||
                discovered.InstanceId == localId || discovered.RequesterInstanceId != localId ||
                discovered.Nonce != nonce || discovered.Timestamp < nowSeconds - 300 ||
                discovered.Timestamp > nowSeconds + 300 ||
                !FederationPublicKey.TryParse(discovered.PublicKeySpki, out var key,
                    out var fingerprint) ||
                !FederationProbeProtocol.Verify(key,
                    FederationIdentityDiscoveryProtocol.ResponseBytes(discovered.InstanceId,
                        localId, discovered.Timestamp, nonce, fingerprint),
                    discovered.Signature)) return null;
            return new DiscoveredFederationPeer(discovered.InstanceId,
                Convert.ToBase64String(key), fingerprint, now);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
            JsonException or CryptographicException or UriFormatException)
        {
            return null;
        }
    }
}
