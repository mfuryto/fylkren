using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemDescendantLoader
{
    internal static async Task<List<WorkItem>> Load(
        WorkItem root,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var result = new List<WorkItem> { root };
        var loadedIds = new HashSet<Guid> { root.Id };
        var parentIds = new[] { root.Id };

        while (parentIds.Length > 0)
        {
            var children = await database.WorkItems
                .Where(item => item.ParentWorkItemId != null && parentIds.Contains(item.ParentWorkItemId.Value))
                .ToListAsync(cancellationToken);
            if (children.Count == 0) break;

            var nextParentIds = new List<Guid>(children.Count);
            foreach (var child in children)
            {
                if (!loadedIds.Add(child.Id)) continue;
                result.Add(child);
                nextParentIds.Add(child.Id);
            }

            parentIds = [.. nextParentIds];
        }

        return result;
    }
}
