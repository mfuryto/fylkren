import { describe, expect, it } from "vitest";
import { addPlanAllocation } from "./planAllocations";

describe("addPlanAllocation", () => {
  it("keeps all lines in one subtask and can allocate to multiple units", () => {
    const tasks = Array.from({ length: 10 }, (_, index) => `${index + 1}. Task ${index + 1}`).join("\n");
    const first = addPlanAllocation([], "plan", "section-1", tasks);
    const result = addPlanAllocation(first, "plan", "section-2", "Support section 1");
    expect(result).toHaveLength(2);
    expect(result[0].instruction).toBe(tasks);
    expect(result[0].instruction.split("\n")).toHaveLength(10);
    expect(result[1].instruction).toBe("Support section 1");
  });

  it("prevents duplicate subtasks for the same recipient in one step", () => {
    const first = addPlanAllocation([], "plan", "section-1", "Task");
    expect(() => addPlanAllocation(first, "plan", "section-1", "More work")).toThrow("already has a subtask");
  });
});
