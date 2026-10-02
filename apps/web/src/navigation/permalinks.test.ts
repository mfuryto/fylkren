import { describe, expect, it } from "vitest";
import { buildAppHash, parseAppLocation } from "./permalinks";

describe("permalinks", () => {
  it.each(["../platform", "../../../../platform/branding?x=", "id?other=value", "%2Fplatform", "id#fragment", "id\u0000"])("rejects URL syntax in identifiers before API path construction: %s", value => {
    const parsed = parseAppLocation(buildAppHash({ page: "Tasks", siteId: value, unitId: value, itemId: value, runId: value, reportId: value }));
    expect(parsed).toMatchObject({ page: "Tasks", siteId: undefined, unitId: undefined, itemId: undefined, runId: undefined, reportId: undefined });
  });
  it.each(["%3Cscript%3E", "%253Cscript%253E", "&item=other#fragment?query", "+ % ", "&lt;script&gt;"])("encodes query values once and preserves literal input: %s", taskSearch => {
    const hash = buildAppHash({ page: "Tasks", siteId: "site-1", itemId: "item-2", taskSearch });
    expect(parseAppLocation(hash)).toMatchObject({ page: "Tasks", siteId: "site-1", itemId: "item-2", taskSearch });
    expect(new URLSearchParams(hash.split("?")[1]).getAll("item")).toEqual(["item-2"]);
  });
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
