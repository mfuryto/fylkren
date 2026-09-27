namespace Fylkren.Api.Platform;

internal sealed class CanonicalHostMiddleware
{
    private readonly RequestDelegate _next;
    private readonly HostString _publicAuthority;

    public CanonicalHostMiddleware(RequestDelegate next, FylkrenOptions options)
    {
        _next = next;
        var publicUri = new Uri(options.PublicUrl);
        _publicAuthority = publicUri.IsDefaultPort
            ? new HostString(publicUri.IdnHost)
            : new HostString(publicUri.IdnHost, publicUri.Port);
    }

    public async Task InvokeAsync(HttpContext context)
    {
        // Container health checks deliberately address the API through loopback. All browser,
        // authentication and machine-API traffic must use the installation's canonical host.
        if (!context.Request.Path.Equals("/health", StringComparison.OrdinalIgnoreCase) &&
            !context.Request.Host.Equals(_publicAuthority))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            return;
        }

        await _next(context);
    }
}
