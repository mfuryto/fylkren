using System.Net;
using System.Net.Sockets;

namespace Fylkren.Api.Networking;

// SMTP/directory hosts are explicit administrator-owned configuration and may
// be private. Share HTTP's special-address rules; do not accept URLs/host lists.
// Native clients still resolve the approved name again: this is DNS preflight,
// not socket pinning. Deployment egress must cover that remaining rebind window.
public sealed class ServiceDestinationPolicy
{
    private readonly Func<string, CancellationToken, Task<IPAddress[]>> resolve;
    public ServiceDestinationPolicy() : this((host, ct) => Dns.GetHostAddressesAsync(host, ct)) { }
    internal ServiceDestinationPolicy(Func<string, CancellationToken, Task<IPAddress[]>> resolver) => resolve = resolver;
    internal static bool ValidServer(string? host)
    {
        if (string.IsNullOrWhiteSpace(host) || host.Length > 255 || host.Any(c => char.IsControl(c) || char.IsWhiteSpace(c)) ||
            host.IndexOfAny(['@', '/', '\\', '?', '#', ';', '[', ']']) >= 0) return false;
        if (IPAddress.TryParse(host, out var ip)) return OutboundHttpPolicy.AllowedAddress(ip, allowPrivate: true);
        return Uri.CheckHostName(host) == UriHostNameType.Dns;
    }
    internal async Task<bool> Allowed(string host, CancellationToken ct)
    {
        if (!ValidServer(host)) return false;
        try
        {
            var addresses = await resolve(host, ct);
            return addresses.Length > 0 && addresses.All(ip => OutboundHttpPolicy.AllowedAddress(ip, allowPrivate: true));
        }
        catch (SocketException) { return false; }
    }
    internal bool Allowed(string host)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try { return Allowed(host, timeout.Token).GetAwaiter().GetResult(); }
        catch (OperationCanceledException) { return false; }
    }
}
