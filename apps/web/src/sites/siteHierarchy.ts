import type { PlacementOption, SiteSummary } from "../siteAdmin/models";
import { compareActiveLanguage } from "../localization";

export type SiteHierarchy = {
  orderedSites: SiteSummary[];
  placementById: Map<string, PlacementOption>;
  siteDepths: Map<string, number>;
  childSitesByParent: Map<string, SiteSummary[]>;
};

export function buildSiteHierarchy(
  sites: SiteSummary[],
  placements: PlacementOption[],
): SiteHierarchy {
  const placementById = new Map(placements.map((placement) => [placement.id, placement]));
  const parentSiteBySite = new Map(
    sites.map((site) => [
      site.id,
      site.parentOrganizationUnitId
        ? (placementById.get(site.parentOrganizationUnitId)?.siteId ?? null)
        : null,
    ]),
  );
  const childSitesByParent = new Map<string, SiteSummary[]>();
  sites.forEach((site) => {
    const parentId = parentSiteBySite.get(site.id);
    if (!parentId) return;
    childSitesByParent.set(parentId, [
      ...(childSitesByParent.get(parentId) ?? []),
      site,
    ]);
  });
  childSitesByParent.forEach((children) =>
    children.sort((a, b) => compareActiveLanguage(a.name, b.name)),
  );

  const siteById = new Map(sites.map((site) => [site.id, site]));
  const siteDepths = new Map<string, number>();
  function siteDepth(siteId: string, visited = new Set<string>()): number {
    const cached = siteDepths.get(siteId);
    if (cached !== undefined) return cached;
    const parentId = parentSiteBySite.get(siteId);
    if (!parentId || !siteById.has(parentId) || visited.has(siteId)) {
      siteDepths.set(siteId, 0);
      return 0;
    }
    const depth = siteDepth(parentId, new Set(visited).add(siteId)) + 1;
    siteDepths.set(siteId, depth);
    return depth;
  }
  sites.forEach((site) => siteDepth(site.id));

  const orderedSites: SiteSummary[] = [];
  const appendedSiteIds = new Set<string>();
  function appendSiteBranch(site: SiteSummary) {
    if (appendedSiteIds.has(site.id)) return;
    appendedSiteIds.add(site.id);
    orderedSites.push(site);
    (childSitesByParent.get(site.id) ?? []).forEach(appendSiteBranch);
  }

  [...sites]
    .filter((site) => {
      const parentId = parentSiteBySite.get(site.id);
      return !parentId || !siteById.has(parentId);
    })
    .sort((a, b) => compareActiveLanguage(a.name, b.name))
    .forEach(appendSiteBranch);
  [...sites]
    .sort((a, b) => compareActiveLanguage(a.name, b.name))
    .forEach(appendSiteBranch);

  return { orderedSites, placementById, siteDepths, childSitesByParent };
}

export function filterSites(
  sites: SiteSummary[],
  placementById: Map<string, PlacementOption>,
  query: string,
) {
  const normalizedQuery = query.trim().toLowerCase();
  return sites.filter((site) => {
    const placement = site.parentOrganizationUnitId
      ? placementById.get(site.parentOrganizationUnitId)
      : undefined;
    return `${site.name} ${site.siteManagers.map((manager) => manager.displayName).join(" ")} ${placement?.siteName ?? ""} ${placement?.unitName ?? ""}`
      .toLowerCase()
      .includes(normalizedQuery);
  });
}
