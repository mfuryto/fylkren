using System.Security.Claims;
using Microsoft.AspNetCore.Routing;

namespace Fylkren.Api.Platform;

public sealed class SecurityEventMiddleware(RequestDelegate next, ILogger<SecurityEventMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        await next(context);

        if (!context.Request.Path.StartsWithSegments("/api")) return;

        var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? "unmatched-api-route";
        var actorPersonId = context.User.FindFirstValue("fylkren:person_id") ?? "anonymous";
        var statusCode = context.Response.StatusCode;

        if (statusCode is StatusCodes.Status401Unauthorized or StatusCodes.Status403Forbidden)
        {
            // A restored browser tab or an expired session routinely performs protected reads
            // before the client can redirect to sign-in. Keep the denial structured, but do not
            // present an expected anonymous read as an operational warning. Authenticated denials
            // and every anonymous state-changing attempt remain warnings.
            var routineAnonymousRead = statusCode == StatusCodes.Status401Unauthorized &&
                actorPersonId == "anonymous" &&
                (HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method));
            var level = routineAnonymousRead ? LogLevel.Information : LogLevel.Warning;
            logger.Log(
                level,
                new EventId(4101, "AccessRejected"),
                "Security event {SecurityEvent}; method={Method}; route={Route}; status={StatusCode}; actorPersonId={ActorPersonId}; traceId={TraceId}",
                "access-rejected",
                SafeLogValue(context.Request.Method),
                SafeLogValue(route),
                statusCode,
                SafeLogValue(actorPersonId),
                SafeLogValue(context.TraceIdentifier));
        }
    }

    private static string SafeLogValue(string value) =>
        value.Replace("\r", " ", StringComparison.Ordinal)
            .Replace("\n", " ", StringComparison.Ordinal);
}
