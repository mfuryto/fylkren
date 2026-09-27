using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Organization;

internal static class OrganizationPath
{
    internal static async Task<IReadOnlyDictionary<Guid, Node>> Load(
        Guid siteId,
        FylkrenDbContext db,
        CancellationToken ct) =>
        (await db.OrganizationUnits
            .AsNoTracking()
            .Where(unit => unit.SiteId == siteId)
            .Select(unit => new Node(
                unit.Id,
                unit.ParentId,
                unit.Name,
                unit.IsSiteRoot,
                unit.IsSiteLeadership))
            .ToListAsync(ct))
        .ToDictionary(unit => unit.Id);

    internal static string[] Build(
        Guid? unitId,
        IReadOnlyDictionary<Guid, Node> units)
    {
        var path = new List<string>();
        var visited = new HashSet<Guid>();
        for (var current = unitId;
             current is Guid id && visited.Add(id) && units.TryGetValue(id, out var unit);
             current = unit.ParentId)
        {
            if (!unit.IsSiteRoot && !unit.IsSiteLeadership)
                path.Add(unit.Name);
        }

        path.Reverse();
        return [.. path];
    }

    internal sealed record Node(
        Guid Id,
        Guid? ParentId,
        string Name,
        bool IsSiteRoot,
        bool IsSiteLeadership);
}
