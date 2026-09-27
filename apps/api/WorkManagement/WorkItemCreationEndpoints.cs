using Microsoft.AspNetCore.Routing;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemCreationEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        PrimaryWorkItemCreationEndpoints.Map(group);
        SideRequestCreationEndpoints.Map(group);
    }
}
