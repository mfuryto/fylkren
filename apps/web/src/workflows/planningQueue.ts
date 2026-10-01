import type { TaskUnit } from "../work/WorkContextModels";
import type { PlanningDraft, PlanningRun } from "./PlanningModels";
import { compareActiveLanguage, translateActive } from "../localization";

export function buildPlanningLevels(runs: PlanningRun[]) {
  return Array.from(new Map(runs.map(run => [
    run.item.assignedUnitId ?? "top",
    run.item.assignedUnitName ?? translateActive("topLevel"),
  ])).entries()).sort((a, b) => compareActiveLanguage(a[1], b[1]));
}

export function filterPlanningRuns(runs: PlanningRun[], levelFilter: string) {
  if (levelFilter === "all") return runs;
  return runs.filter(run => (run.item.assignedUnitId ?? "top") === levelFilter);
}

export function planningAllocationUnits(units: TaskUnit[], siteId: string, run: PlanningRun) {
  return units
    .filter(unit =>
      unit.siteId === siteId &&
      (!unit.isSiteLeadership || Boolean(unit.receivingSiteId)) &&
      (run.item.assignedUnitId
        ? unit.parentId === run.item.assignedUnitId
        : unit.parentId === null),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || compareActiveLanguage(a.name, b.name));
}

export function createPlanningDraft(run: PlanningRun): PlanningDraft {
  return {
    priority: run.proposedPriority ?? "normal",
    dueAt: run.proposedDueAt ? run.proposedDueAt.slice(0, 10) : "",
    allocations: run.allocations.map(allocation => ({
      stepId: allocation.stepId,
      unitId: allocation.unitId,
      instruction: allocation.instruction,
    })),
  };
}
