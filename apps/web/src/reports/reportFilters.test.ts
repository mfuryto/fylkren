import { describe, expect, it } from "vitest";
import type { TaskUnit } from "../work/WorkContextModels";
import { availableReportUnits, availableReportYears } from "./reportFilters";

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Unit", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: false, ...values,
});

describe("reportFilters", () => {
  it("shows only the user's operational units at the selected site", () => {
    const visible = unit({ id: "visible" });
    const leadership = unit({ id: "leadership", isSiteLeadership: true });
    const unavailable = unit({ id: "unavailable", assignedToMe: false });
    const foreign = unit({ id: "foreign", siteId: "other" });
    expect(availableReportUnits([leadership, unavailable, foreign, visible], "site").map(value => value.id)).toEqual(["visible"]);
  });

  it("retains the selected year and sorts newest first", () => {
    expect(availableReportYears([2024, 2026, 2024], "2025")).toEqual([2026, 2025, 2024]);
  });
});
