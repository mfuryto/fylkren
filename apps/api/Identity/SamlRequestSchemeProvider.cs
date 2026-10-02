using Fylkren.Api.Platform;
using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Options;
using Sustainsys.Saml2.AspNetCore2;
using AuthenticationOptions = Microsoft.AspNetCore.Authentication.AuthenticationOptions;

namespace Fylkren.Api.Identity;

internal sealed class SamlRequestSchemeProvider(
    IOptions<AuthenticationOptions> authentication,
    IHttpContextAccessor contexts,
    FylkrenOptions options) : AuthenticationSchemeProvider(authentication)
{
    public override async Task<IEnumerable<AuthenticationScheme>> GetRequestHandlerSchemesAsync()
    {
        var schemes = await base.GetRequestHandlerSchemesAsync();
        var context = contexts.HttpContext;
        if (context is null || context.Request.Path.StartsWithSegments(options.Authentication.Saml.ModulePath))
            return schemes;

        // SAML metadata loads during handler initialization. Only its callback
        // routes need that handler; explicit SAML challenges resolve it separately.
        return schemes.Where(scheme => scheme.Name != Saml2Defaults.Scheme);
    }
}
