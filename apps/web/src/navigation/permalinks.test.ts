import { describe, expect, it } from "vitest";
import { buildAppHash, parseAppLocation } from "./permalinks";

describe("permalinks", () => {
  it("round-trips a task link", () => {
    const hash = buildAppHash({ page: "Oppgaver", siteId: "site-1", itemId: "item-2" });
    expect(hash).toBe("#/tasks?site=site-1&item=item-2");
    expect(parseAppLocation(hash)).toMatchObject({ page: "Oppgaver", siteId: "site-1", itemId: "item-2" });
  });

  it("supports planning and falls back safely", () => {
    expect(parseAppLocation("#/planning?site=s&run=r")).toMatchObject({ page: "Planlegging", siteId: "s", runId: "r" });
    expect(parseAppLocation("#/oppgaver?site=s&item=i")).toMatchObject({ page: "Oppgaver", siteId: "s", itemId: "i" });
    expect(parseAppLocation("#/ukjent").page).toBe("Oversikt");
  });

  it("preserves the task queue view during in-app navigation", () => {
    const hash = buildAppHash({ page: "Oppgaver", siteId: "site-1", unitId: "unit-2", itemId: "item-3", taskFilter: "active", taskSearch: "beredskap" });
    expect(parseAppLocation(hash)).toMatchObject({ page: "Oppgaver", siteId: "site-1", unitId: "unit-2", itemId: "item-3", taskFilter: "active", taskSearch: "beredskap" });
  });

  it("round-trips every Platform Manager page, including License", () => {
    for (const page of ["Plattform", "Sites", "Identitet", "Klassifisering", "API", "Lisens", "E-post", "Utseende", "Revisjon"])
      expect(parseAppLocation(buildAppHash({ page })).page).toBe(page);
  });
});
