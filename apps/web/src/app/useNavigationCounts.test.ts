import { describe, expect, it } from "vitest";
import { navigationCountLabel } from "./useNavigationCounts";
import { buildNavigation } from "./navigationPolicy";

describe("pending work navigation", () => {
  it("puts workload immediately after reports", () => {
    const result = buildNavigation({ authenticated: true, isPlatformManager: false, hasOperationalRole: true,
      canPlan: true, canExecute: true, isTopLevelLeader: true }, "Overview");
    expect(result.navigationItems).toEqual(["Overview", "Tasks", "Planning", "Execution", "Reports", "Workload", "Learning"]);
  });
  it("adds positive counts to the three workspaces without altering other labels", () => {
    const counts = { tasks: 3, planning: 2, execution: 1, learning: 4 };
    expect(navigationCountLabel("Tasks", "Tasks", counts)).toBe("Tasks (3)");
    expect(navigationCountLabel("Planning", "Planning", counts)).toBe("Planning (2)");
    expect(navigationCountLabel("Execution", "Execution", counts)).toBe("Execution (1)");
    expect(navigationCountLabel("Learning", "Learning", counts)).toBe("Learning (4)");
    expect(navigationCountLabel("Reports", "Reports", counts)).toBe("Reports");
    expect(navigationCountLabel("Tasks", "Tasks", null)).toBe("Tasks");
    expect(navigationCountLabel("Tasks", "Tasks", { ...counts, tasks: 0 })).toBe("Tasks");
  });
});
