using Fido2NetLib;
using Microsoft.AspNetCore.Diagnostics;

namespace Fylkren.Api.Identity;

internal sealed class WebAuthnVerificationExceptionHandler(
    ILogger<WebAuthnVerificationExceptionHandler> logger) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (!context.Request.Path.StartsWithSegments("/api/webauthn") ||
            exception is not Fido2VerificationException)
            return false;

        logger.LogWarning(new EventId(4103, "WebAuthnRejected"),
            "Security event {SecurityEvent}; authenticationScheme={AuthenticationScheme}; traceId={TraceId}",
            "authenticator-verification-rejected", "WebAuthn", context.TraceIdentifier);
        context.Response.StatusCode = context.Request.Path.StartsWithSegments("/api/webauthn/login")
            ? StatusCodes.Status401Unauthorized
            : StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/problem+json";
        context.Response.Headers.CacheControl = "no-store";
        await context.Response.WriteAsJsonAsync(new { error = "authenticator_verification_failed" }, cancellationToken);
        return true;
    }
}
