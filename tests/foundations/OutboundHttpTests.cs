using System.Net;
using System.Security.Cryptography;
using System.Security.Cryptography.X509Certificates;
using Fylkren.Api.Networking;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

internal static class OutboundHttpTests
{
    private static void Require(bool value, string message) { if (!value) throw new Exception(message); }
    internal static async Task Run()
    {
        var rejected = new[] { "0.0.0.0", "127.0.0.1", "127.20.0.1", "10.1.2.3", "172.16.0.1", "192.168.1.1", "169.254.169.254", "100.64.0.1", "198.18.0.1", "224.0.0.1", "255.255.255.255", "::", "::1", "::ffff:127.0.0.1", "fe80::1", "fc00::1", "ff02::1", "64:ff9b::7f00:1", "2002:7f00:1::", "2001:db8::1", "2001:2::1", "3fff::1", "3fff:fff::1", "168.63.129.16", "fd00:ec2::254" };
        foreach (var ip in rejected) Require(!OutboundHttpPolicy.AllowedAddress(IPAddress.Parse(ip), false), $"Address {ip} bypassed default restriction.");
        foreach (var ip in new[] { "169.254.169.254", "0.0.0.0", "ff02::1", "fe80::1", "100.64.0.1" }) Require(!OutboundHttpPolicy.AllowedAddress(IPAddress.Parse(ip), true), "Private exception authorized a reserved/metadata address.");
        foreach (var ip in new[] { "8.8.8.8", "1.1.1.1", "2606:4700:4700::1111" }) Require(OutboundHttpPolicy.AllowedAddress(IPAddress.Parse(ip), false), "Ordinary public address was blocked.");
        foreach (var origin in new[] { "http://example.invalid", "https://user:password@example.invalid", "https://example.invalid/path", "https://example.invalid?secret=x", "https://example.invalid#fragment" })
        {
            try { OutboundHttpPolicy.ParseOrigins(origin); throw new Exception("Unsafe origin accepted."); } catch (ArgumentException) { }
        }
        using var rsa = RSA.Create(2048);
        var certificateRequest = new CertificateRequest("CN=receiver.test", rsa, System.Security.Cryptography.HashAlgorithmName.SHA256, RSASignaturePadding.Pkcs1);
        var san = new SubjectAlternativeNameBuilder(); san.AddDnsName("receiver.test"); certificateRequest.CertificateExtensions.Add(san.Build());
        using var cert = certificateRequest.CreateSelfSigned(DateTimeOffset.UtcNow.AddMinutes(-1), DateTimeOffset.UtcNow.AddHours(1));
        var builder = WebApplication.CreateBuilder(); builder.Logging.ClearProviders();
        builder.WebHost.ConfigureKestrel(k => k.Listen(IPAddress.Loopback, 0, l => l.UseHttps(cert)));
        await using var app = builder.Build(); var requests = 0; var canary = 0;
        app.MapGet("/ok", () => { Interlocked.Increment(ref requests); return Results.Text("Valid bounded response"); });
        app.MapGet("/redirect", (HttpContext c) => { Interlocked.Increment(ref requests); c.Response.Redirect("/canary"); return Task.CompletedTask; });
        app.MapGet("/canary", () => { Interlocked.Increment(ref canary); return Results.Ok(); });
        app.MapGet("/large-length", (HttpContext c) => { c.Response.ContentLength = 4097; return c.Response.WriteAsync(new string('x', 4097)); });
        app.MapGet("/chunked", async (HttpContext c) => { for (var i = 0; i < 10; i++) { await c.Response.WriteAsync(new string('x', 1024)); await c.Response.Body.FlushAsync(); } });
        app.MapGet("/large-headers", (HttpContext c) => { c.Response.Headers["X-Synthetic"] = new string('x', 35_000); return c.Response.WriteAsync("ok"); });
        app.MapGet("/exact", () => Results.Text(new string('x', 4096)));
        await app.StartAsync();
        var port = new Uri(app.Urls.Single()).Port;
        var originValue = $"https://receiver.test:{port}"; var dnsCalls = 0;
        Task<IPAddress[]> Resolve(string _, CancellationToken ct) { Interlocked.Increment(ref dnsCalls); return Task.FromResult(new[] { IPAddress.Loopback }); }
        using var transport = new OutboundHttpPolicy(originValue, resolve: Resolve).CreateTransport();
        transport.SslOptions.RemoteCertificateValidationCallback = (_, certificate, _, _) => certificate?.GetCertHashString() == cert.GetCertHashString();
        using var client = new HttpClient(new BoundedResponseHandler(transport, 4096)) { Timeout = TimeSpan.FromSeconds(2) };
        Require(await client.GetStringAsync(originValue + "/ok") == "Valid bounded response", "Explicit private origin failed trusted TLS.");
        Require(dnsCalls == 1, "Checked TLS connection performed more than one DNS lookup.");
        using (var redirect = await client.GetAsync(originValue + "/redirect")) Require((int)redirect.StatusCode == 302 && canary == 0, "Redirect followed or canary fetched.");
        Require((await client.GetStringAsync(originValue + "/exact")).Length == 4096, "Exact byte limit rejected.");
        await Reject(() => client.GetStringAsync(originValue + "/large-length"));
        await Reject(() => client.GetStringAsync(originValue + "/chunked"));
        await Reject(() => client.GetStringAsync(originValue + "/large-headers"));
        using var untrustedTls = new HttpClient(new BoundedResponseHandler(new OutboundHttpPolicy(originValue, resolve: Resolve).CreateTransport(), 4096));
        await Reject(() => untrustedTls.GetAsync(originValue + "/ok"));
        var before = requests;
        using var blocked = new HttpClient(new BoundedResponseHandler(new OutboundHttpPolicy("", resolve: Resolve).CreateTransport(), 4096));
        await Reject(() => blocked.GetAsync(originValue + "/ok"));
        Require(requests == before, "Default private DNS reached the receiver.");
        using var mixed = new HttpClient(new BoundedResponseHandler(new OutboundHttpPolicy("", resolve: (_, _) => Task.FromResult(new[] { IPAddress.Parse("8.8.8.8"), IPAddress.Loopback })).CreateTransport(), 4096));
        await Reject(() => mixed.GetAsync(originValue + "/ok"));
        // Exact origin: authorizing a different port does not permit this target.
        using var wrongPort = new HttpClient(new BoundedResponseHandler(new OutboundHttpPolicy("https://receiver.test:443", resolve: Resolve).CreateTransport(), 4096));
        await Reject(() => wrongPort.GetAsync(originValue + "/ok"));
        var identity = new OutboundHttpPolicy("", "https://keys.example.invalid");
        identity.ValidateIdentityDestination(new Uri("https://idp.example.invalid/realm/token"), "https://idp.example.invalid/realm");
        identity.ValidateIdentityDestination(new Uri("https://keys.example.invalid/jwks"), "https://idp.example.invalid/realm");
        try { identity.ValidateIdentityDestination(new Uri("https://evil.example.invalid/token"), "https://idp.example.invalid/realm"); throw new Exception("Metadata selected an unapproved token origin."); } catch (HttpRequestException) { }
        Require(canary == 0 && dnsCalls > 0, "Network checks did not execute.");
        await app.StopAsync();
        Console.WriteLine("Outbound HTTPS tests passed: IP/DNS/IPv4-mapped boundaries, exact private origins/ports, actual trusted TLS positive, rejected private and mixed DNS with no receiver request, pinned connection, no redirect canary, Content-Length/chunked/exact byte limits, oversized headers, invalid TLS rejection and OIDC origin isolation.");
    }
    private static async Task Reject(Func<Task> action)
    {
        try { await action(); } catch (HttpRequestException) { return; }
        throw new Exception("Unsafe outbound response/destination accepted.");
    }
}
