using Microsoft.AspNetCore.Routing;

namespace Fylkren.Api.WorkManagement;

internal static class WorkContextEndpoints
{
    internal static void Map(RouteGroupBuilder group)
    {
        WorkContextQueryEndpoints.Map(group);
        WorkRequestRecipientEndpoints.Map(group);
        WorkloadQueryEndpoints.Map(group);
    }
}
