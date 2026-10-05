using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using Fylkren.Api.Identity;
using Fylkren.Api.Networking;
using Fylkren.Api.Notifications;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.DataProtection;

internal static class ServiceTransportTests
{
    internal static async Task Run()
    {
        void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
        foreach (var host in new[] { "ldap", "mail.internal", "ad.example.test", "127.0.0.1", "10.1.2.3", "::1", "fd01::1", "2606:4700::1" })
            Require(ServiceDestinationPolicy.ValidServer(host), "Ordinary administrator-selected server was rejected.");
        foreach (var host in new[] { "https://mail.test", "ldap://ldap", "ldap mail", "ldap;mail", "ldap:636", "user@ldap", "ldap/path", "ldap?x=y", "ldap#x", "ldap\nmail", "ldap\tmail", "169.254.169.254", "::ffff:169.254.169.254", "168.63.129.16", "fd00:ec2::254", "ff02::1", "fe80::1", "0.0.0.0" })
            Require(!ServiceDestinationPolicy.ValidServer(host), "Malformed/metadata service host was accepted.");
        var lookups = 0;
        var forbidden = new ServiceDestinationPolicy((_, _) => { lookups++; return Task.FromResult(new[] { IPAddress.Parse("169.254.169.254") }); });
        Require(!await forbidden.Allowed("metadata-alias.test", default), "Metadata DNS alias passed preflight.");
        var mixed = new ServiceDestinationPolicy((_, _) => Task.FromResult(new[] { IPAddress.Loopback, IPAddress.Parse("169.254.169.254") }));
        Require(!await mixed.Allowed("mixed-alias.test", default), "Mixed allowed/metadata DNS passed preflight.");
        var approved = new ServiceDestinationPolicy((_, _) => Task.FromResult(new[] { IPAddress.Loopback }));
        Require(await approved.Allowed("explicit-relay.test", default), "Explicit private relay did not pass preflight.");
        var configuration = new FylkrenOptions();
        configuration.Authentication.Ldap.Enabled = true;
        configuration.Authentication.Ldap.Server = "metadata-alias.test";
        configuration.Authentication.Ldap.BaseDn = "dc=synthetic,dc=test";
        configuration.Authentication.Ldap.BindDn = "cn=synthetic,dc=synthetic,dc=test";
        configuration.Authentication.Ldap.BindPassword = "Synthetic-in-memory-only";
        var directory = new DirectoryAuthenticationService(configuration, forbidden);
        Require(!await directory.TestConnectionAsync("ldap", default), "LDAP metadata DNS destination passed connection preparation.");
        var smtp = new SmtpSettings(Guid.NewGuid());
        smtp.Update(true, "metadata-alias.test", 25, "starttls", null, null, "sender@example.invalid", "Synthetic");
        try
        {
            using var message = new MailMessage("sender@example.invalid", "recipient@example.invalid", "Synthetic", "Synthetic");
            await SmtpTransport.SendAsync(smtp, new EphemeralDataProtectionProvider().CreateProtector("Synthetic"),
                forbidden, message, default);
            throw new Exception("SMTP metadata DNS destination passed connection preparation.");
        }
        catch (SmtpException) { }
        Require(lookups == 3, "Directory/SMTP native client preparation bypassed the DNS policy.");

        // Simulate a DNS change between policy resolution and the LDAP client's
        // own resolution. Only the preflight-approved address may reach a socket.
        using var canary = new TcpListener(IPAddress.Loopback, 0);
        canary.Start();
        var rebindingOptions = new FylkrenOptions();
        rebindingOptions.Authentication.Ldap.Enabled = true;
        rebindingOptions.Authentication.Ldap.Server = "localhost";
        rebindingOptions.Authentication.Ldap.Port = ((IPEndPoint)canary.LocalEndpoint).Port;
        rebindingOptions.Authentication.Ldap.BaseDn = "dc=synthetic,dc=test";
        rebindingOptions.Authentication.Ldap.BindDn = "cn=synthetic,dc=synthetic,dc=test";
        rebindingOptions.Authentication.Ldap.BindPassword = "Synthetic-in-memory-only";
        var changedDns = new ServiceDestinationPolicy((_, _) =>
            Task.FromResult(new[] { IPAddress.Parse("127.0.0.2") }));
        var reboundDirectory = new DirectoryAuthenticationService(rebindingOptions, changedDns);
        Require(!await reboundDirectory.TestConnectionAsync("ldap", default),
            "LDAP accepted a second-resolution address outside the approved result set.");
        Require(!canary.Pending(), "LDAP opened a socket to a DNS-rebound address.");
        Console.WriteLine("Service transport tests passed: host/port syntax, reserved/mapped metadata hosts, named and mixed metadata DNS rejection, explicit private service hosts, LDAP/SMTP client preparation rejection, and LDAP second-resolution address pinning.");
    }
}
