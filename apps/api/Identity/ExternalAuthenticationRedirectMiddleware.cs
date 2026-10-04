using Fylkren.Api.Networking;
using Fylkren.Api.Platform;

namespace Fylkren.Api.Identity;

// Validate the actual browser destination after the authentication handler has
// built its redirect. OIDC discovery can replace the preliminary protocol
// address after provider events have run, so the final Location is authoritative.
internal sealed class ExternalAuthenticationRedirectMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context, FylkrenOptions options, OutboundHttpPolicy destinations)
    {
        if (context.Request.Path == "/api/auth/oidc/login")
        {
            context.Response.OnStarting(() =>
            {
                if (context.Response.StatusCode is < 300 or > 399 ||
                    !context.Response.Headers.TryGetValue("Location", out var location)) return Task.CompletedTask;
                try
                {
                    if (!Uri.TryCreate(location.ToString(), UriKind.Absolute, out var target))
                        throw new HttpRequestException("OIDC redirect destination is invalid.");
                    destinations.ValidateIdentityDestination(target, options.Authentication.Oidc.Authority);
                }
                catch (HttpRequestException)
                {
                    // The authentication handler has already prepared the response at this
                    // point. Suppress both the unapproved redirect and transient cookies.
                    context.Response.StatusCode = StatusCodes.Status502BadGateway;
                    context.Response.Headers.Remove("Location");
                    context.Response.Headers.Remove("Set-Cookie");
                    context.Response.Headers.CacheControl = "no-store";
                    context.Response.ContentLength = 0;
                }
                return Task.CompletedTask;
            });
        }
        return next(context);
    }
}
