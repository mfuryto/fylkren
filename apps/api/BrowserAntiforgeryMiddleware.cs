using Microsoft.AspNetCore.Antiforgery;
using Microsoft.AspNetCore.Authorization;

namespace Fylkren.Api;

internal sealed class BrowserAntiforgeryMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, IAntiforgery antiforgery)
    {
        if (RequiresValidation(context) && !await antiforgery.IsRequestValidAsync(context))
        {
            context.Response.StatusCode = StatusCodes.Status400BadRequest;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "Sikkerhetskontrollen utløp. Last siden på nytt og prøv igjen."
            });
            return;
        }

        await next(context);
    }

    private static bool RequiresValidation(HttpContext context) =>
        context.User.Identity?.IsAuthenticated == true &&
        context.User.FindFirst("fylkren:machine_id") is null &&
        context.Request.Path.StartsWithSegments("/api") &&
        context.Request.Method is "POST" or "PUT" or "PATCH" or "DELETE" &&
        context.GetEndpoint()?.Metadata.GetMetadata<IAllowAnonymous>() is null;
}
