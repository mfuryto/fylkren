namespace Fylkren.Api.Platform;

public static partial class PlatformUserEndpoints
{
    public static RouteGroupBuilder MapPlatformUserEndpoints(this RouteGroupBuilder group)
    {
        group.MapGet("/users", GetUsers);
        group.MapPost("/users/{personId:guid}/move", MoveUser);
        group.MapPost("/users/password", ResetUserPasswords);
        group.MapPost("/users/assign", AssignUsers);
        group.MapPost("/users/delete", DeleteUsers);
        return group;
    }
    private sealed record MoveUserRequest(Guid SourceSiteId, Guid TargetSiteId);
    private sealed record BulkResetPasswordRequest(Guid[] PersonIds);
    private sealed record BulkAssignRequest(Guid[] PersonIds, Guid SiteId);
    private sealed record BulkDeleteRequest(Guid[] PersonIds);
}
