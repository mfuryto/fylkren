using System.Security.Claims;
using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

public static class WorkflowEndpoints
{
    public static IEndpointRouteBuilder MapWorkflowEndpoints(this IEndpointRouteBuilder endpoints)
    {
        var g = endpoints.MapGroup("/api/workflows").RequireAuthorization();
        WorkflowDefinitionEndpoints.Map(g);
        PlanningQueueEndpoints.Map(g);
        PlanningAssignmentEndpoints.Map(g);
        PlanningDocumentEndpoints.Map(g);
        PlanningRequestEndpoints.Map(g);
        PlanningRfiEndpoints.Map(g);
        PlanningSubmissionEndpoints.Map(g);
        PlanningDecisionEndpoints.Map(g);
        return endpoints;
    }
    internal static bool Pid(ClaimsPrincipal u, out Guid p) => Guid.TryParse(u.FindFirstValue("fylkren:person_id"), out p);
    internal static Task<bool> SiteAdministrator(Guid s, Guid p, FylkrenDbContext d, CancellationToken c) => d.SiteManagerAssignments.AnyAsync(x => x.SiteId == s && x.PersonId == p && x.IsActive && x.Site.IsActive, c);
    internal sealed record WorkflowStepRequest(string Name, bool IsOptional, bool AllowsTaskAllocation, Guid? TemplateId, bool HasTimeline); internal sealed record CreateWorkflow(string Name, Guid? OwnerUnitId, string Kind, IReadOnlyList<WorkflowStepRequest> Steps);
}
