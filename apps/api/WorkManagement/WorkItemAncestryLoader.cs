using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemAncestryLoader
{
    internal static async Task<Dictionary<Guid, Node>> Load(
        Guid siteId,
        IEnumerable<Guid?> startingIds,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var hierarchy = new Dictionary<Guid, Node>();
        var pending = startingIds.Where(value => value.HasValue).Select(value => value!.Value).ToHashSet();
        while (pending.Count > 0)
        {
            var nodes = await database.WorkItems.AsNoTracking()
                .Where(value => value.SiteId == siteId && pending.Contains(value.Id))
                .Select(value => new Node(
                    value.Id,
                    value.ParentWorkItemId,
                    value.Title,
                    value.WorkflowRun != null && value.WorkflowRun.Definition.Kind == "planning"))
                .ToListAsync(cancellationToken);
            if (nodes.Count == 0) break;
            pending.Clear();
            foreach (var node in nodes)
            {
                hierarchy.TryAdd(node.Id, node);
                if (node.ParentWorkItemId is Guid parentId && !hierarchy.ContainsKey(parentId)) pending.Add(parentId);
            }
        }
        return hierarchy;
    }

    internal sealed record Node(Guid Id, Guid? ParentWorkItemId, string Title, bool HasPlan);
}
