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
            var routineExpiredConfigurationRefresh = statusCode == StatusCodes.Status401Unauthorized &&
                actorPersonId == "anonymous" && route == "/api/configuration";
            var level = routineExpiredConfigurationRefresh ? LogLevel.Information : LogLevel.Warning;
            logger.Log(
                level,
                new EventId(4101, "AccessRejected"),
                "Security event {SecurityEvent}; method={Method}; route={Route}; status={StatusCode}; actorPersonId={ActorPersonId}; traceId={TraceId}",
                "access-rejected",
                context.Request.Method,
                route,
                statusCode,
                actorPersonId,
                context.TraceIdentifier);
        }
    }
}
