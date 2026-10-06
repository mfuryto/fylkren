using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text.Json;

namespace Fylkren.Api.Federation;

internal sealed record FederationCapabilitySelection(string? Error, int ProtocolVersion,
    string? SignatureAlgorithm, string[] MessageTypes)
{
    internal bool IsValid => Error is null;
}

internal static class FederationCapabilityClient
{
    private static readonly ConcurrentDictionary<Guid, CachedSelection> Cache = new();

    internal static async Task<FederationCapabilitySelection> Negotiate(Guid localId,
        FederationPeer peer, ECDsa localKey, byte[] peerKey, string requiredMessageType,
        IHttpClientFactory clients, CancellationToken ct)
    {
        var cacheKey = peer.PinnedPublicKeySpki ?? string.Empty;
        if (Cache.TryGetValue(peer.InstanceId, out var cached) &&
            cached.PublicKeySpki == cacheKey && cached.ExpiresAt > DateTimeOffset.UtcNow &&
            cached.MessageTypes.Contains(requiredMessageType, StringComparer.Ordinal))
        {
            peer.RecordProtocol(cached.Selection.ProtocolVersion,
                cached.Selection.SignatureAlgorithm);
            return cached.Selection;
        }

        var legacy = await Exchange(localId, peer, localKey, peerKey, requiredMessageType,
            FederationCapabilityProtocol.LegacyProtocolVersion, null, clients, ct);
        if (!legacy.IsValid) return legacy;

        var current = await Exchange(localId, peer, localKey, peerKey, requiredMessageType,
            FederationCapabilityProtocol.ProtocolVersion,
            FederationSignatureProtocol.CurrentAlgorithm, clients, ct);
        var selected = current.IsValid ? current : legacy;
        if (!current.IsValid && peer.NegotiatedProtocolVersion >= FederationCapabilityProtocol.ProtocolVersion)
            return new FederationCapabilitySelection("remote_protocol_downgrade", 0, null, []);
        peer.RecordProtocol(selected.ProtocolVersion, selected.SignatureAlgorithm);
        Cache[peer.InstanceId] = new CachedSelection(cacheKey,
            DateTimeOffset.UtcNow.AddMinutes(5), selected.MessageTypes, selected);
        return selected;
    }

    private static async Task<FederationCapabilitySelection> Exchange(Guid localId,
        FederationPeer peer, ECDsa localKey, byte[] peerKey, string requiredMessageType,
        int protocolVersion, string? signatureAlgorithm, IHttpClientFactory clients,
        CancellationToken ct)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
        var nonce = Guid.NewGuid();
        var unsigned = new FederationCapabilityRequest(localId, peer.InstanceId,
            protocolVersion, protocolVersion, FederationCapabilityProtocol.WorkSchemaVersions,
            FederationCapabilityProtocol.WorkMessageTypes, timestamp, nonce, null,
            signatureAlgorithm);
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
                if (protocolVersion > FederationCapabilityProtocol.LegacyProtocolVersion &&
                    response.StatusCode is HttpStatusCode.BadRequest or HttpStatusCode.Unauthorized or
                        HttpStatusCode.Conflict or HttpStatusCode.NotFound)
                    return new FederationCapabilitySelection("remote_protocol_incompatible", 0, null, []);
                if (response.StatusCode != HttpStatusCode.Conflict)
                    return new FederationCapabilitySelection("remote_capability_unavailable", 0, null, []);
                await response.Content.LoadIntoBufferAsync(16_384, ct);
                using var error = await JsonDocument.ParseAsync(
                    await response.Content.ReadAsStreamAsync(ct), cancellationToken: ct);
                var code = error.RootElement.TryGetProperty("error", out var value) ? value.GetString() : null;
                return new FederationCapabilitySelection(code == "federation_clock_skew"
                    ? "remote_clock_skew" : "remote_protocol_incompatible", 0, null, []);
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
                return new FederationCapabilitySelection("invalid_capability_response", 0, null, []);
            return new FederationCapabilitySelection(null, selected.ProtocolVersion,
                selected.SignatureAlgorithm, selected.WorkMessageTypes);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or
            JsonException or CryptographicException or UriFormatException)
        {
            return new FederationCapabilitySelection("remote_capability_unavailable", 0, null, []);
        }
    }

    private sealed record CachedSelection(string PublicKeySpki, DateTimeOffset ExpiresAt,
        string[] MessageTypes, FederationCapabilitySelection Selection);
}
