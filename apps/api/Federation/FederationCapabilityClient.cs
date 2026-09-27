using System.Collections.Concurrent;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;

namespace Fylkren.Api.Federation;

internal static class FederationCapabilityClient
{
    private static readonly ConcurrentDictionary<Guid, CachedSelection> Cache = new();

    internal static async Task<string?> Negotiate(Guid localId, FederationPeer peer,
        ECDsa localKey, byte[] peerKey, string requiredMessageType,
        IHttpClientFactory clients, CancellationToken ct)
    {
        var cacheKey = peer.PinnedPublicKeySpki ?? string.Empty;
        if (Cache.TryGetValue(peer.InstanceId, out var cached) &&
            cached.PublicKeySpki == cacheKey && cached.ExpiresAt > DateTimeOffset.UtcNow &&
            cached.MessageTypes.Contains(requiredMessageType, StringComparer.Ordinal))
            return null;
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var nonce = Guid.NewGuid();
        var unsigned = new FederationCapabilityRequest(localId, peer.InstanceId,
            FederationCapabilityProtocol.ProtocolVersion,
            FederationCapabilityProtocol.ProtocolVersion,
            FederationCapabilityProtocol.WorkSchemaVersions,
            FederationCapabilityProtocol.WorkMessageTypes, timestamp, nonce, null);
        var request = unsigned with { Signature = FederationProbeProtocol.Sign(localKey,
            FederationCapabilityProtocol.RequestBytes(unsigned)) };
        try
        {
            var target = new Uri(new Uri(peer.BaseUrl + "/"), "api/federation/v1/capabilities");
            using var outgoing = new HttpRequestMessage(HttpMethod.Post, target)
            {
                Content = JsonContent.Create(request)
            };
            using var response = await clients.CreateClient("federation-probe")
                .SendAsync(outgoing, HttpCompletionOption.ResponseHeadersRead, ct);
            if (!response.IsSuccessStatusCode)
            {
                if (response.StatusCode != System.Net.HttpStatusCode.Conflict)
                    return "remote_capability_unavailable";
                await response.Content.LoadIntoBufferAsync(16_384, ct);
                using var error = await JsonDocument.ParseAsync(
                    await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                return error.RootElement.TryGetProperty("error", out var code) &&
                    code.GetString() == "federation_clock_skew"
                    ? "remote_clock_skew" : "remote_protocol_incompatible";
            }
            await response.Content.LoadIntoBufferAsync(16_384, ct);
            var selected = await response.Content
                .ReadFromJsonAsync<FederationCapabilityResponse>(cancellationToken: ct);
            var now = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            if (selected is null || selected.SenderInstanceId != peer.InstanceId ||
                selected.RecipientInstanceId != localId || selected.Nonce != nonce ||
                selected.Timestamp < now - 300 || selected.Timestamp > now + 300 ||
                !FederationCapabilityProtocol.ValidSelection(selected, request) ||
                selected.WorkSchemaVersion != FederationWorkProtocol.SchemaVersion ||
                !selected.WorkMessageTypes.Contains(requiredMessageType, StringComparer.Ordinal) ||
                !FederationProbeProtocol.Verify(peerKey,
                    FederationCapabilityProtocol.ResponseBytes(selected), selected.Signature))
                return "invalid_capability_response";
            Cache[peer.InstanceId] = new CachedSelection(cacheKey,
                DateTimeOffset.UtcNow.AddMinutes(5), selected.WorkMessageTypes);
            return null;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
            JsonException or CryptographicException or UriFormatException)
        {
            return "remote_capability_unavailable";
        }
    }

    private sealed record CachedSelection(string PublicKeySpki, DateTimeOffset ExpiresAt,
        string[] MessageTypes);
}
