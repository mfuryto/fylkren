import { compareActiveLanguage, translateActive } from "../localization";
import type { TaskUnit } from "../work/WorkContextModels";
import type { ExecutionDefinition, ExecutionItem } from "./ExecutionModels";

export function executionStatus(item: ExecutionItem) {
  const run = item.run;
  if (!run) return translateActive("workflowsPlanningQueueListAvailable");
  if (run.status === "claimed") return translateActive("responsibilityClaimed");
  if (run.status === "in_progress") return translateActive("workflowsExecutionQueueInExecution");
  return run.status;
}

export function executionDefinitionOptions(
  definitions: ExecutionDefinition[],
  units: TaskUnit[],
  siteId: string,
  item: ExecutionItem,
) {
  return definitions.filter(definition =>
    definition.ownerUnitId === null ||
    definition.ownerUnitId === item.assignedUnitId ||
    item.assignedUnitId === null && units.some(unit =>
      unit.siteId === siteId && unit.isSiteLeadership && unit.id === definition.ownerUnitId,
    ),
  );
}

export function executionChildUnits(units: TaskUnit[], siteId: string, item: ExecutionItem) {
  return units
    .filter(unit =>
      unit.siteId === siteId &&
      !unit.isSiteLeadership &&
      (item.assignedUnitId ? unit.parentId === item.assignedUnitId : unit.parentId === null),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || compareActiveLanguage(a.name, b.name));
}
