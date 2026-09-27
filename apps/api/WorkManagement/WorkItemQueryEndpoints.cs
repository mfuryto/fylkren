using Microsoft.AspNetCore.Routing;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemQueryEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        WorkItemListQueryEndpoints.Map(group);
        ReportQueryEndpoints.Map(group);
        WorkItemDetailQueryEndpoints.Map(group);
    }
}
