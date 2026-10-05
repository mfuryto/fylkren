using System.Net;
using System.Net.Sockets;

namespace Fylkren.Api.Networking;

// SMTP/directory hosts are explicit administrator-owned configuration and may
// be private. Share HTTP's special-address rules; do not accept URLs/host lists.
// Resolve once and pass these approved addresses to the actual transport. Native
// clients must never receive the original DNS name as their network destination.
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
    internal async Task<IPAddress[]> ResolveAllowed(string host, CancellationToken ct)
    {
        if (!ValidServer(host)) return [];
        try
        {
            var addresses = await resolve(host, ct);
            return addresses.Length > 0 && addresses.All(ip => OutboundHttpPolicy.AllowedAddress(ip, allowPrivate: true))
                ? addresses.Distinct().ToArray()
                : [];
        }
        catch (SocketException) { return []; }
    }
    internal async Task<bool> Allowed(string host, CancellationToken ct) =>
        (await ResolveAllowed(host, ct)).Length > 0;
    internal bool Allowed(string host)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try { return Allowed(host, timeout.Token).GetAwaiter().GetResult(); }
        catch (OperationCanceledException) { return false; }
    }

    internal IPAddress[] ResolveAllowed(string host)
    {
        using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(10));
        try { return ResolveAllowed(host, timeout.Token).GetAwaiter().GetResult(); }
        catch (OperationCanceledException) { return []; }
    }
}
