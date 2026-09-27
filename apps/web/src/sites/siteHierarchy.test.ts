import { describe, expect, it } from "vitest";
import type { PlacementOption, SiteSummary } from "../siteAdmin/models";
import { buildSiteHierarchy, filterSites } from "./siteHierarchy";

const site = (id: string, name: string, parentOrganizationUnitId: string | null): SiteSummary => ({
  id,
  name,
  isActive: true,
  parentOrganizationUnitId,
  overviewDesign: "classic",
  siteManagers: [],
});

describe("site hierarchy", () => {
  it("orders parent sites before children and calculates indentation depth", () => {
    const sites = [site("child", "Barn", "parent-root"), site("parent", "Forelder", null)];
    const placements: PlacementOption[] = [{
      id: "parent-root",
      siteId: "parent",
      siteName: "Forelder",
      unitName: "Rot",
      isSiteRoot: true,
    }];
    const result = buildSiteHierarchy(sites, placements);
    expect(result.orderedSites.map((value) => value.id)).toEqual(["parent", "child"]);
    expect(result.siteDepths.get("child")).toBe(1);
  });

  it("searches site names and placement names", () => {
    const sites = [site("child", "Barn", "parent-root")];
    const placements: PlacementOption[] = [{
      id: "parent-root",
      siteId: "parent",
      siteName: "Forelder",
      unitName: "Ledelse",
      isSiteRoot: true,
    }];
    const hierarchy = buildSiteHierarchy(sites, placements);
    expect(filterSites(hierarchy.orderedSites, hierarchy.placementById, "ledelse")).toHaveLength(1);
  });
});
