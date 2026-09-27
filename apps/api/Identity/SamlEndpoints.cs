using Microsoft.AspNetCore.Authentication;
using Sustainsys.Saml2.AspNetCore2;

namespace Fylkren.Api.Identity;

public static class SamlEndpoints
{
    public static IEndpointRouteBuilder MapSamlEndpoints(this IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/auth/saml/login", (Fylkren.Api.Platform.FylkrenOptions options) =>
            options.Authentication.Saml.Enabled
                ? Results.Challenge(new AuthenticationProperties { RedirectUri = "/" }, [Saml2Defaults.Scheme])
                : Results.NotFound()).AllowAnonymous();
        return endpoints;
    }
}
