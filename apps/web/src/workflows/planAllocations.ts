import { translateActive } from "../localization";
import type { PlanAllocation } from "./PlanningModels";

export function addPlanAllocation(allocations: PlanAllocation[], stepId: string, unitId: string, instruction: string): PlanAllocation[] {
  const text = instruction.trim();
  if (!unitId || !text || text.length > 10000) throw new Error(translateActive("workflowsPlanAllocationsSelectARecipientAndEnterTask"));
  if (allocations.some(allocation => allocation.stepId === stepId && allocation.unitId === unitId)) {
    throw new Error(translateActive("workflowsPlanAllocationsTheUnitAlreadyHasASubtask"));
  }
  return [...allocations, { stepId, unitId, instruction: text }];
}
