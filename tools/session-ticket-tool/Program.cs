using System.Security.Claims;
using System.Security.Cryptography;
using System.Text.Json;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.DataProtection;

if (args.Length != 2) throw new ArgumentException("Expected cookie value and Data Protection key directory.");
var provider = DataProtectionProvider.Create(new DirectoryInfo(args[1]), options => options.SetApplicationName("Fylkren"));
var format = new TicketDataFormat(provider.CreateProtector(
    "Microsoft.AspNetCore.Authentication.Cookies.CookieAuthenticationMiddleware", "Cookies", "v2"));
var now = DateTimeOffset.UtcNow;

string Protect(DateTimeOffset issued, DateTimeOffset expires, DateTimeOffset sessionStarted)
{
    var ticket = format.Unprotect(args[0]) ?? throw new CryptographicException("Session ticket could not be unprotected.");
    var identity = new ClaimsIdentity((ClaimsIdentity)ticket.Principal.Identity!);
    foreach (var claim in identity.FindAll("fylkren:session_started_at").ToArray()) identity.RemoveClaim(claim);
    identity.AddClaim(new Claim("fylkren:session_started_at", sessionStarted.ToUnixTimeSeconds().ToString()));
    ticket.Properties.IssuedUtc = issued;
    ticket.Properties.ExpiresUtc = expires;
    return format.Protect(new AuthenticationTicket(new ClaimsPrincipal(identity), ticket.Properties, ticket.AuthenticationScheme));
}

Console.WriteLine(JsonSerializer.Serialize(new
{
    inactivityBefore = Protect(now.AddMinutes(-59), now.AddMinutes(1), now),
    inactivityAfter = Protect(now.AddMinutes(-61), now.AddMinutes(-1), now),
    absoluteBefore = Protect(now.AddMinutes(-59), now.AddMinutes(1), now.AddHours(-12).AddMinutes(1)),
    absoluteAfter = Protect(now.AddMinutes(-59), now.AddMinutes(1), now.AddHours(-12).AddSeconds(-1))
}));
