using System.Net;
using System.Net.Mail;
using System.Net.Sockets;
using Fylkren.Api.Networking;
using Fylkren.Api.Platform;
using MailKit.Security;
using Microsoft.AspNetCore.DataProtection;
using MimeKit;
using MailKitSmtpClient = MailKit.Net.Smtp.SmtpClient;

namespace Fylkren.Api.Notifications;

internal static class SmtpTransport
{
    internal static async Task SendAsync(SmtpSettings smtp, IDataProtector protector,
        ServiceDestinationPolicy destinations, MailMessage message, CancellationToken cancellationToken)
    {
        if (smtp.Security != "starttls")
            throw new SmtpException("Unencrypted SMTP is not supported. Configure STARTTLS.");
        var addresses = await destinations.ResolveAllowed(smtp.Host, cancellationToken);
        if (addresses.Length == 0)
            throw new SmtpException("The configured SMTP destination is not allowed or available.");

        Socket? socket = null;
        try
        {
            foreach (var address in addresses)
            {
                socket = new Socket(address.AddressFamily, SocketType.Stream, ProtocolType.Tcp) { NoDelay = true };
                try { await socket.ConnectAsync(new IPEndPoint(address, smtp.Port), cancellationToken); break; }
                catch (SocketException) { socket.Dispose(); socket = null; }
            }
            if (socket is null) throw new SmtpException("The configured SMTP destination could not be reached.");

            // Private and air-gapped relays commonly use an internal CA without
            // an online CRL. Chain, validity and hostname checks remain enabled.
            using var client = new MailKitSmtpClient { Timeout = 10000, CheckCertificateRevocation = false };
            await client.ConnectAsync(socket, smtp.Host, smtp.Port, SecureSocketOptions.StartTls, cancellationToken);
            socket = null; // MailKit owns the connected socket after ConnectAsync succeeds.
            if (smtp.Username is not null)
            {
                if (smtp.ProtectedPassword is null) throw new InvalidOperationException("SMTP password missing.");
                await client.AuthenticateAsync(smtp.Username, protector.Unprotect(smtp.ProtectedPassword), cancellationToken);
            }
            await client.SendAsync(MimeMessage.CreateFromMailMessage(message), cancellationToken);
            await client.DisconnectAsync(true, cancellationToken);
        }
        catch (Exception error) when (error is not SmtpException and not InvalidOperationException and not OperationCanceledException)
        { throw new SmtpException("SMTP delivery failed.", error); }
        finally { socket?.Dispose(); }
    }
}
