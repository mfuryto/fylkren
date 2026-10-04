using System.Net;
using System.Net.Sockets;

namespace Fylkren.Api.Networking;

// The integration's configured URL is its destination. Private routes additionally
// require a deployment-owned exact origin exception, never a request/body flag.
internal sealed class OutboundHttpPolicy(string privateOrigins, string identityOrigins = "",
    Func<string, CancellationToken, Task<IPAddress[]>>? resolve = null)
{
    private readonly HashSet<string> privateAllowed = ParseOrigins(privateOrigins);
    private readonly HashSet<string> identityAllowed = ParseOrigins(identityOrigins);
    private readonly Func<string, CancellationToken, Task<IPAddress[]>> resolver = resolve ?? ((host, ct) => Dns.GetHostAddressesAsync(host, ct));

    internal static HashSet<string> ParseOrigins(string input)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var value in input.Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            if (!Uri.TryCreate(value, UriKind.Absolute, out var uri) || !ValidUri(uri) || uri.AbsolutePath != "/" || uri.Query != "")
                throw new ArgumentException("Outbound exceptions must be exact HTTPS origins without credentials, paths, queries or fragments.");
            result.Add(Origin(uri));
        }
        return result;
    }
    internal static string Origin(Uri uri) => uri.GetLeftPart(UriPartial.Authority).ToLowerInvariant();
    internal static bool ValidUri(Uri uri) => uri.IsAbsoluteUri && uri.Scheme == Uri.UriSchemeHttps &&
        uri.UserInfo == "" && uri.Fragment == "" && uri.Host != "" && !uri.OriginalString.Any(char.IsControl);
    internal void ValidateIdentityDestination(Uri uri, string? authority)
    {
        if (!ValidUri(uri) || authority is null || !Uri.TryCreate(authority, UriKind.Absolute, out var configured) ||
            Origin(uri) != Origin(configured) && !identityAllowed.Contains(Origin(uri)))
            throw new HttpRequestException("Identity-provider destination is outside its approved origins.");
    }
    internal SocketsHttpHandler CreateTransport() => new()
    {
        AllowAutoRedirect = false, UseProxy = false, MaxResponseDrainSize = 0,
        MaxResponseHeadersLength = 32, ConnectTimeout = TimeSpan.FromSeconds(10),
        PooledConnectionLifetime = TimeSpan.FromMinutes(2),
        ConnectCallback = Connect
    };
    private async ValueTask<Stream> Connect(SocketsHttpConnectionContext context, CancellationToken ct)
    {
        var uri = context.InitialRequestMessage.RequestUri!;
        if (!ValidUri(uri) || !string.Equals(uri.IdnHost, context.DnsEndPoint.Host, StringComparison.OrdinalIgnoreCase) || uri.Port != context.DnsEndPoint.Port)
            throw new HttpRequestException("Invalid outbound destination.");
        var addresses = await resolver(uri.IdnHost, ct);
        if (addresses.Length == 0 || addresses.Any(ip => !AllowedAddress(ip, privateAllowed.Contains(Origin(uri)))))
            throw new HttpRequestException("Outbound destination resolved to a prohibited address.");
        // Connect to the checked IP itself. Do not perform a second DNS lookup.
        foreach (var address in addresses)
        {
            var socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
            try { await socket.ConnectAsync(new IPEndPoint(address, uri.Port), ct); return new NetworkStream(socket, ownsSocket: true); }
            catch (SocketException) { socket.Dispose(); }
            catch { socket.Dispose(); throw; }
        }
        throw new HttpRequestException("Outbound destination could not be reached.");
    }
    internal static bool AllowedAddress(IPAddress address, bool allowPrivate)
    {
        if (address.IsIPv4MappedToIPv6) address = address.MapToIPv4();
        if (address.Equals(IPAddress.Parse("168.63.129.16")) || address.Equals(IPAddress.Parse("fd00:ec2::254"))) return false;
        var bytes = address.GetAddressBytes();
        if (address.AddressFamily == AddressFamily.InterNetwork)
        {
            if (bytes[0] == 0 || bytes[0] >= 224 || bytes[0] == 169 && bytes[1] == 254 ||
                bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 0 ||
                bytes[0] == 100 && bytes[1] is >= 64 and <= 127 ||
                bytes[0] == 198 && bytes[1] is 18 or 19 ||
                bytes[0] == 192 && bytes[1] == 0 && bytes[2] == 2 ||
                bytes[0] == 198 && bytes[1] == 51 && bytes[2] == 100 ||
                bytes[0] == 203 && bytes[1] == 0 && bytes[2] == 113 ||
                bytes[0] == 192 && bytes[1] == 88 && bytes[2] == 99) return false;
            var local = bytes[0] == 127 || bytes[0] == 10 || bytes[0] == 172 && bytes[1] is >= 16 and <= 31 || bytes[0] == 192 && bytes[1] == 168;
            return !local || allowPrivate;
        }
        if (address.AddressFamily != AddressFamily.InterNetworkV6 || address.Equals(IPAddress.IPv6Any) || address.IsIPv6LinkLocal || address.IsIPv6Multicast || address.ScopeId != 0) return false;
        if (address.Equals(IPAddress.IPv6Loopback) || (bytes[0] & 0xfe) == 0xfc) return allowPrivate;
        // Global unicast only; exclude translation/tunnel/documentation ranges.
        return (bytes[0] & 0xe0) == 0x20 && !(bytes[0] == 0x20 && bytes[1] == 0x02) &&
            !(bytes[0] == 0x20 && bytes[1] == 0x01 && (bytes[2] & 0xfe) == 0) &&
            !(bytes[0] == 0x20 && bytes[1] == 0x01 && bytes[2] == 0x0d && bytes[3] == 0xb8) &&
            !(bytes[0] == 0x3f && bytes[1] == 0xff && (bytes[2] & 0xf0) == 0);
    }
}
