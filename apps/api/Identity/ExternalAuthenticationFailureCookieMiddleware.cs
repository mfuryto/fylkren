using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.Extensions.Options;

namespace Fylkren.Api.Identity;

internal sealed class ExternalAuthenticationFailureCookieMiddleware(
    RequestDelegate next,
    Fylkren.Api.Platform.FylkrenOptions options,
    IOptionsMonitor<CookieAuthenticationOptions> cookieOptions)
{
    public async Task InvokeAsync(HttpContext context)
    {
        var isOidcCallback = context.Request.Path == options.Authentication.Oidc.CallbackPath;
        var isSamlCallback = context.Request.Path.StartsWithSegments(options.Authentication.Saml.ModulePath);
        if (isOidcCallback || isSamlCallback)
        {
            context.Response.OnStarting(() =>
            {
                if (context.Response.StatusCode >= StatusCodes.Status400BadRequest)
                {
                    // Some external handlers can append the application cookie before a later
                    // protocol validation (for example replay detection) rejects the callback.
                    // Append the deletion at the final response boundary so no rejected callback
                    // can leave either a previous or partially issued Fylkren session usable.
                    var authentication = cookieOptions.Get(CookieAuthenticationDefaults.AuthenticationScheme);
                    authentication.CookieManager.DeleteCookie(
                        context, authentication.Cookie.Name!, authentication.Cookie.Build(context));
                }
                return Task.CompletedTask;
            });
        }
        await next(context);
    }
}
