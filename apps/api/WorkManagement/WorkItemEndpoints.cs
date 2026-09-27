namespace Fylkren.Api.WorkManagement;

public static class WorkItemEndpoints
{
    public static IEndpointRouteBuilder MapWorkItemEndpoints(
        this IEndpointRouteBuilder endpoints)
    {
        var group = endpoints.MapGroup("/api/work").RequireAuthorization();
        WorkItemLookupEndpoints.Map(group);
        WorkContextEndpoints.Map(group);
        WorkItemQueryEndpoints.Map(group);
        WorkItemCreationEndpoints.Map(group);
        WorkItemRoutingEndpoints.Map(group);
        WorkItemStatusEndpoints.Map(group);
        WorkItemCompletionEndpoints.Map(group);
        WorkItemDependencyEndpoints.Map(group);
        return endpoints;
    }
}
