import type { PlanAllocation } from "./PlanningModels";

export function addPlanAllocation(allocations: PlanAllocation[], stepId: string, unitId: string, instruction: string): PlanAllocation[] {
  const text = instruction.trim();
  if (!unitId || !text || text.length > 10000) throw new Error("Select a recipient and enter task text of at most 10,000 characters.");
  if (allocations.some(allocation => allocation.stepId === stepId && allocation.unitId === unitId)) {
    throw new Error("The unit already has a subtask in this planning step. Edit the task list above.");
  }
  return [...allocations, { stepId, unitId, instruction: text }];
}
