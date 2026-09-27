using System.Security.Claims;

namespace Fylkren.Api.WorkManagement;

public static class ExecutionEndpoints
{
    public static IEndpointRouteBuilder MapExecutionEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/execution").RequireAuthorization();
        ExecutionQueryEndpoints.Map(group);
        ExecutionAssignmentEndpoints.Map(group);
        ExecutionWorkflowEndpoints.Map(group);
        ExecutionDocumentEndpoints.Map(group);
        ExecutionFollowUpEndpoints.Map(group);
        ExecutionCompletionEndpoints.Map(group);
        return endpoints;
    }

    internal static bool PersonId(ClaimsPrincipal user, out Guid id) => Guid.TryParse(user.FindFirstValue("fylkren:person_id"), out id);
}
