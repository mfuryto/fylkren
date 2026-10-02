using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.IdentityModel.Tokens;
using System.Net;
using System.Xml;

namespace Fylkren.Api.Identity;

internal sealed class ExternalAuthenticationExceptionHandler(
    Fylkren.Api.Platform.FylkrenOptions options,
    ILogger<ExternalAuthenticationExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken cancellationToken)
    {
        var isSamlChallenge = context.Request.Path.Equals("/api/auth/saml/login", StringComparison.OrdinalIgnoreCase);
        var isSamlValidationFailure = (isSamlChallenge || context.Request.Path.StartsWithSegments(
                options.Authentication.Saml.ModulePath)) &&
            (string.Equals(exception.GetType().Assembly.GetName().Name,
                "Sustainsys.Saml2", StringComparison.Ordinal) ||
             exception is SecurityTokenException or XmlException or HttpRequestException or WebException);
        if (!isSamlValidationFailure) return false;

        logger.LogWarning(
            new EventId(4102, "ExternalAuthenticationRejected"),
            "Security event {SecurityEvent}; authenticationScheme={AuthenticationScheme}; traceId={TraceId}",
            "external-authentication-rejected",
            "Saml2",
            context.TraceIdentifier);
        await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
        context.Response.StatusCode = isSamlChallenge ? StatusCodes.Status502BadGateway : StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/problem+json";
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.WriteAsJsonAsync(new
        {
            error = "external_authentication_failed"
        }, cancellationToken);
        return true;
    }
}
