using System.Net;
using System.Net.Mail;
using Fylkren.Api.Networking;
using Fylkren.Api.Platform;
using Microsoft.AspNetCore.DataProtection;

namespace Fylkren.Api.Notifications;

internal static class SmtpTransport
{
    internal static SmtpClient Create(SmtpSettings smtp, IDataProtector protector, ServiceDestinationPolicy destinations)
    {
        if (smtp.Security != "starttls")
            throw new SmtpException("Unencrypted SMTP is not supported. Configure STARTTLS.");
        if (!destinations.Allowed(smtp.Host)) throw new SmtpException("The configured SMTP destination is not allowed or available.");
        var client = new SmtpClient(smtp.Host, smtp.Port) { EnableSsl = true, Timeout = 10000 };
        if (smtp.Username is null) return client;
        try
        {
            if (smtp.ProtectedPassword is null) throw new InvalidOperationException("SMTP password missing.");
            client.Credentials = new NetworkCredential(smtp.Username, protector.Unprotect(smtp.ProtectedPassword));
            return client;
        }
        catch { client.Dispose(); throw; }
    }
}
