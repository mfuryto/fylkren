namespace Fylkren.Api;

// Browser pages may be upgraded to HTTPS. API, health and authentication
// callback clients must receive an explicit failure so accidental plaintext
// service traffic cannot be hidden behind a transparent redirect.
internal sealed class PlainHttpBoundaryMiddleware(RequestDelegate next)
{
    public Task InvokeAsync(HttpContext context)
    {
        if (context.Request.IsHttps) return next(context);
        if (context.Request.Path.StartsWithSegments("/api") ||
            context.Request.Path.StartsWithSegments("/health") ||
            context.Request.Path.StartsWithSegments("/signin-oidc"))
        {
            context.Response.Headers.CacheControl = "no-store";
            return Results.Json(new
            {
                type = "https://tools.ietf.org/html/rfc9110#section-15.5.1",
                title = "HTTPS is required.",
                status = StatusCodes.Status400BadRequest
            }, statusCode: StatusCodes.Status400BadRequest,
                contentType: "application/problem+json; charset=utf-8").ExecuteAsync(context);
        }

        context.Response.Redirect(
            $"https://{context.Request.Host}{context.Request.PathBase}{context.Request.Path}{context.Request.QueryString}",
            permanent: false, preserveMethod: true);
        return Task.CompletedTask;
    }
}
