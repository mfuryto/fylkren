using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.OpenIdConnect;

namespace Fylkren.Api.Identity;

public static class OidcEndpoints
{
    public static IEndpointRouteBuilder MapOidcEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/auth/oidc/login", (Fylkren.Api.Platform.FylkrenOptions options) =>
            options.Authentication.Oidc.Enabled
                ? Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }, [OpenIdConnectDefaults.AuthenticationScheme])
                : Results.NotFound()).AllowAnonymous();
        return endpoints;
    }
}
