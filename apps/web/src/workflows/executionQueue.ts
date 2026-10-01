import type { TaskUnit } from "../work/WorkContextModels";
import type { ExecutionDefinition, ExecutionItem } from "./ExecutionModels";

export function executionStatus(item: ExecutionItem) {
  const run = item.run;
  if (!run) return "Togjengelig";
  if (run.status === "claimed") return "Ansvar tatt";
  if (run.status === "in_progress") return "In execution";
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
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "nb"));
}
