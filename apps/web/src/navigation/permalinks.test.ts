import { describe, expect, it } from "vitest";
import { buildAppHash, parseAppLocation } from "./permalinks";

describe("permalinks", () => {
  it("round-trips a task link", () => {
    const hash = buildAppHash({ page: "Tasks", siteId: "site-1", itemId: "item-2" });
    expect(hash).toBe("#/tasks?site=site-1&item=item-2");
    expect(parseAppLocation(hash)).toMatchObject({ page: "Tasks", siteId: "site-1", itemId: "item-2" });
  });

  it("supports planning and falls back safely", () => {
    expect(parseAppLocation("#/planning?site=s&run=r")).toMatchObject({ page: "Planning", siteId: "s", runId: "r" });
    expect(parseAppLocation("#/tasks?site=s&item=i")).toMatchObject({ page: "Tasks", siteId: "s", itemId: "i" });
    expect(parseAppLocation("#/unknown").page).toBe("Overview");
  });

  it("preserves the task queue view during in-app navigation", () => {
    const hash = buildAppHash({ page: "Tasks", siteId: "site-1", unitId: "unit-2", itemId: "item-3", taskFilter: "active", taskSearch: "readiness" });
    expect(parseAppLocation(hash)).toMatchObject({ page: "Tasks", siteId: "site-1", unitId: "unit-2", itemId: "item-3", taskFilter: "active", taskSearch: "readiness" });
  });

  it("round-trips every Platform Manager page, including License", () => {
    for (const page of ["Platform", "Sites", "Identity", "Classifications", "API", "License", "Email", "Appearance", "Audit"] as const)
      expect(parseAppLocation(buildAppHash({ page })).page).toBe(page);
  });
});
