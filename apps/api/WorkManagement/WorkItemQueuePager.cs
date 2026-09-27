using Fylkren.Api.Persistence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.WorkManagement;

internal static class WorkItemQueuePager
{
    private const int PageSize = 20;
    private static readonly HashSet<string> TerminalStatuses = ["completed", "rejected", "cancelled", "reassigned"];
    private static readonly HashSet<string> UnassignedStatuses = ["registered", "under_review", "on_hold", "planning", "planning_approved", "execution"];

    internal static async Task<Result> Select(
        IQueryable<WorkItem> visibleQuery,
        Guid siteId,
        Guid? unitId,
        string filter,
        string? search,
        int requestedPage,
        Guid? focusItemId,
        FylkrenDbContext database,
        CancellationToken cancellationToken)
    {
        var includeSearchText = !string.IsNullOrWhiteSpace(search);
        var nodes = await visibleQuery.Select(item => new Node(
            item.Id,
            item.ParentWorkItem != null && item.ParentWorkItem.SiteId != siteId && item.SiteId == siteId ? null : item.ParentWorkItemId,
            item.ParentWorkItem == null ? null : item.ParentWorkItem.Title,
            item.AssignedUnitId,
            includeSearchText ? item.Title : "",
            includeSearchText ? item.Description : "",
            includeSearchText ? item.Recommendation : null,
            includeSearchText ? item.WorkItemType == null ? item.WorkItemTypeNameSnapshot : item.WorkItemType.Name : null,
            includeSearchText ? item.SourceType == null ? item.SourceTypeNameSnapshot : item.SourceType.Name : null,
            includeSearchText ? item.Sender == null ? item.SenderNameSnapshot : item.Sender.Name : null,
            includeSearchText ? item.SenderSiteName : null,
            includeSearchText ? item.SenderPersonName : null,
            includeSearchText ? item.AssignedUnit == null ? item.SiteId != siteId ? item.Site.Name : null : item.AssignedUnit.Name : null,
            includeSearchText ? item.CreatedByPerson == null ? item.SenderSiteName ?? "Ekstern site" : item.CreatedByPerson.DisplayName : "",
            includeSearchText ? item.FinalReport : null,
            item.Status,
            item.CreatedAt,
            item.DueAt,
            item.WorkItemType != null && item.WorkItemType.IsSystemManaged && item.WorkItemType.NormalizedName == "ANMODNING" && database.WorkItems.Any(child => child.ParentWorkItemId == item.Id && child.SenderSiteName != null && (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId)),
            database.WorkItems.Where(child => child.ParentWorkItemId == item.Id && child.SenderSiteName != null && (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId)).Select(child => child.Status).FirstOrDefault(),
            includeSearchText ? database.WorkItems.Where(child => child.ParentWorkItemId == item.Id && child.SenderSiteName != null && (child.SiteId != item.SiteId || child.AssignedUnitId != item.AssignedUnitId) && child.Status == "completed" && child.FinalReportApprovedAt != null).Select(child => child.FinalReport).FirstOrDefault() : null))
            .ToListAsync(cancellationToken);

        var byId = nodes.ToDictionary(node => node.Id);
        var children = nodes.Where(node => node.ParentId is not null).GroupBy(node => node.ParentId!.Value).ToDictionary(group => group.Key, group => group.ToList());
        var scoped = nodes.Where(node => unitId is Guid selectedUnitId
            ? node.AssignedUnitId == selectedUnitId && !(node.IsOutgoingRequest && node.ParentTitle is not null) && !(node.ParentId is Guid parentId && byId.TryGetValue(parentId, out var parent) && parent.AssignedUnitId == selectedUnitId)
            : node.ParentId is null && !(node.IsOutgoingRequest && node.ParentTitle is not null)).ToList();

        var normalizedSearch = search?.Trim() ?? string.Empty;
        var filtered = scoped.Where(node => MatchesFilter(node, filter) && SubtreeMatches(node, normalizedSearch, children)).OrderByDescending(node => node.CreatedAt).ThenBy(node => node.Id).ToList();
        var page = Math.Max(requestedPage, 1);
        if (focusItemId is Guid focusedId)
        {
            var rootId = RootId(focusedId, byId);
            var index = filtered.FindIndex(node => node.Id == rootId);
            if (index >= 0) page = index / PageSize + 1;
        }

        var total = filtered.Count;
        var totalPages = Math.Max(1, (int)Math.Ceiling(total / (double)PageSize));
        page = Math.Min(page, totalPages);
        var roots = filtered.Skip((page - 1) * PageSize).Take(PageSize).Select(node => node.Id).ToList();
        var selectedIds = IncludeDescendants(roots, children);
        var active = scoped.Where(node => !TerminalStatuses.Contains(EffectiveStatus(node))).ToList();
        var summary = new Summary(active.Count, scoped.Count(node => EffectiveStatus(node) == "in_progress"), scoped.Count(node => EffectiveStatus(node) == "in_review"), active.Count(node => node.DueAt is not null && node.DueAt < DateTimeOffset.UtcNow));
        return new Result(selectedIds, total, page, PageSize, totalPages, summary);
    }

    private static bool MatchesFilter(Node node, string filter)
    {
        var status = EffectiveStatus(node);
        return filter switch
        {
            "all" => true,
            "active" => !TerminalStatuses.Contains(status),
            "unassigned" => UnassignedStatuses.Contains(status),
            _ => status == filter,
        };
    }

    private static bool SubtreeMatches(Node root, string search, IReadOnlyDictionary<Guid, List<Node>> children)
    {
        if (search.Length == 0) return true;
        var pending = new Stack<Node>();
        var visited = new HashSet<Guid>();
        pending.Push(root);
        while (pending.TryPop(out var node))
        {
            if (!visited.Add(node.Id)) continue;
            if (SearchValues(node).Any(value => value?.Contains(search, StringComparison.CurrentCultureIgnoreCase) == true)) return true;
            if (children.TryGetValue(node.Id, out var descendants)) foreach (var descendant in descendants) pending.Push(descendant);
        }
        return false;
    }

    private static IEnumerable<string?> SearchValues(Node node) =>
    [
        node.Title, node.Description, node.Recommendation, node.WorkItemTypeName, node.SourceTypeName,
        node.SenderName, node.SenderSiteName, node.SenderPersonName, node.UnitName, node.CreatedBy,
        node.ParentTitle, node.FinalReport, node.RequestResponse, StatusLabel(EffectiveStatus(node)),
    ];

    private static string EffectiveStatus(Node node)
    {
        if (!node.IsOutgoingRequest || node.Status is "completed" or "cancelled") return node.Status;
        return node.RequestProgressStatus is "completed" or "rejected" or "cancelled" ? "in_review" : "in_progress";
    }

    private static string StatusLabel(string status) => status switch
    {
        "registered" => "Registrert",
        "under_review" => "Til vurdering",
        "on_hold" => "Avventer",
        "rejected" => "Avvist",
        "planning" => "Planlegging",
        "planning_approval" => "Plan til godkjenning",
        "planning_approved" => "Godkjent plan · avventer iverksetting",
        "execution" => "Utførelse",
        "assigned" => "Fordelt",
        "in_progress" => "Pågår",
        "in_review" => "Til kontroll",
        "completed" => "Fullført",
        "cancelled" => "Kansellert",
        "request_cancelled" => "Trukket av avsender",
        "reassigned" => "Omfordelt",
        _ => status,
    };

    private static Guid RootId(Guid id, IReadOnlyDictionary<Guid, Node> nodes)
    {
        var current = id;
        var visited = new HashSet<Guid>();
        while (visited.Add(current) && nodes.TryGetValue(current, out var node) && node.ParentId is Guid parentId && nodes.ContainsKey(parentId)) current = parentId;
        return current;
    }

    private static HashSet<Guid> IncludeDescendants(IEnumerable<Guid> roots, IReadOnlyDictionary<Guid, List<Node>> children)
    {
        var selected = roots.ToHashSet();
        var pending = new Stack<Guid>(selected);
        while (pending.TryPop(out var parentId))
        {
            if (!children.TryGetValue(parentId, out var descendants)) continue;
            foreach (var descendant in descendants) if (selected.Add(descendant.Id)) pending.Push(descendant.Id);
        }
        return selected;
    }

    internal sealed record Result(HashSet<Guid> ItemIds, int Total, int Page, int PageSize, int TotalPages, Summary Summary);
    internal sealed record Summary(int Active, int InProgress, int InReview, int Overdue);
    private sealed record Node(Guid Id, Guid? ParentId, string? ParentTitle, Guid? AssignedUnitId, string Title, string Description, string? Recommendation, string? WorkItemTypeName, string? SourceTypeName, string? SenderName, string? SenderSiteName, string? SenderPersonName, string? UnitName, string CreatedBy, string? FinalReport, string Status, DateTimeOffset CreatedAt, DateTimeOffset? DueAt, bool IsOutgoingRequest, string? RequestProgressStatus, string? RequestResponse);
}
