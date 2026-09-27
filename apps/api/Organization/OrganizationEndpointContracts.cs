namespace Fylkren.Api.Organization;

internal sealed record SiteSummary(Guid Id, Guid? ParentOrganizationUnitId, string Name, bool IsActive, string OverviewDesign, IReadOnlyCollection<PersonSummary> SiteManagers);
internal sealed record CreateSiteRequest(string Name, string OverviewDesign = "classic");
internal sealed record UpdateSiteRequest(string Name, Guid? ParentOrganizationUnitId, bool IsActive, string OverviewDesign = "classic");
internal sealed record AssignSiteManagerRequest(Guid PersonId);
internal sealed record CreateOrganizationUnitRequest(string Name, Guid? ParentId, bool IsTemporary, bool WorksAtParentLevel, bool IsSiteLeadership);
internal sealed record UpdateOrganizationUnitRequest(string Name, Guid? ParentId, bool IsTemporary, bool IsActive, bool WorksAtParentLevel, bool IsSiteLeadership);
internal sealed record ReorderOrganizationUnitRequest(string Direction);
internal sealed record PersonSummary(Guid Id, string DisplayName);
internal sealed record PersonSearchResult(Guid Id, string DisplayName, string? Email);
internal sealed record OrganizationUnitSummary(Guid Id, Guid? ParentId, string Name, bool IsTemporary, bool WorksAtParentLevel, bool IsSiteLeadership, bool IsActive, int SortOrder, bool IsChildSite = false, Guid? LinkedSiteId = null);
internal sealed record PlacementOption(Guid Id, Guid SiteId, string SiteName, string UnitName, bool IsSiteRoot);
