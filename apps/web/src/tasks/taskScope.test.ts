import { describe, expect, it } from "vitest";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { buildTaskScope } from "./taskScope";

const unit = (values: Partial<TaskUnit>): TaskUnit => ({
  id: "unit", siteId: "site", name: "Enhet", parentId: null, isSiteLeadership: false,
  sortOrder: 0, assignedToMe: true, isLeader: false, ...values,
});
const site = (values: Partial<TaskSite> = {}): TaskSite => ({
  siteId: "site", name: "Site", isSiteManager: false, isTopLevelLeader: false,
  hasTopLevelAccess: true, isManager: false, ...values,
});

describe("taskScope", () => {
  it("presents top-level subunits without additional indentation", () => {
    const leadership = unit({ id: "leadership", name: "Ledelse", isSiteLeadership: true });
    const section = unit({ id: "section", name: "Seksjon", parentId: "leadership", sortOrder: 2 });
    const staff = unit({ id: "staff", name: "Stab", parentId: "leadership", sortOrder: 1 });
    const team = unit({ id: "team", name: "Team", parentId: "section" });
    const scope = buildTaskScope([section, team, leadership, staff], "site", "", site());
    expect(scope.selectableUnits.map(value => [value.name, value.depth])).toEqual([["Stab", 0], ["Seksjon", 0], ["Team", 1]]);
    expect(scope.directChildUnits.map(value => value.name)).toEqual(["Stab", "Seksjon"]);
  });

  it("uses leader access on the selected work level", () => {
    const section = unit({ id: "section", isLeader: true });
    const scope = buildTaskScope([section], "site", "section", site({ isTopLevelLeader: false }));
    expect(scope.canManageScope).toBe(true);
  });

  it("ignores a cyclic unit branch without a root", () => {
    const first = unit({ id: "first", parentId: "second" });
    const second = unit({ id: "second", parentId: "first" });
    expect(buildTaskScope([first, second], "site", "", site()).availableUnits).toEqual([]);
  });
});
