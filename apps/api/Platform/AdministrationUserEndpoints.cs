using Microsoft.AspNetCore.Routing;

namespace Fylkren.Api.Platform;

internal static class AdministrationUserEndpoints
{
    internal static void Map(RouteGroupBuilder api)
    {
        api.MapGet("/users", AdministrationUserQueryEndpoints.ListUsers)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "users:read"))
            .RequireRateLimiting("administration-api");
        api.MapGet("/users/{personId:guid}", AdministrationUserQueryEndpoints.GetUser)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "users:read"))
            .RequireRateLimiting("administration-api");
        api.MapPost("/users/{personId:guid}/assign", AdministrationUserCommandEndpoints.AssignUser)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "users:assign"))
            .RequireRateLimiting("administration-api-write");
        api.MapPost("/users/{personId:guid}/move", AdministrationUserCommandEndpoints.MoveUser)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "users:move"))
            .RequireRateLimiting("administration-api-write");
        api.MapPost("/users/{personId:guid}/deactivate", AdministrationUserCommandEndpoints.DeactivateUser)
            .RequireAuthorization(policy => policy.RequireClaim("scope", "users:deactivate"))
            .RequireRateLimiting("administration-api-write");
    }
}
