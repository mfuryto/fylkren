import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import { compareActiveLanguage } from "../localization";

export type TaskUnitWithDepth = TaskUnit & { depth: number };

export function buildTaskScope(taskUnits: TaskUnit[], siteId: string, selectedUnitId: string, site?: TaskSite) {
  const availableUnits: TaskUnitWithDepth[] = [];
  const siteUnits = taskUnits.filter(unit => unit.siteId === siteId);
  const visited = new Set<string>();
  const appendUnits = (parentId: string | null, depth: number) => {
    siteUnits
      .filter(unit => unit.parentId === parentId && !visited.has(unit.id))
      .sort((a, b) => a.sortOrder - b.sortOrder || compareActiveLanguage(a.name, b.name))
      .forEach(unit => {
        visited.add(unit.id);
        availableUnits.push({ ...unit, depth });
        appendUnits(unit.id, depth + 1);
      });
  };
  appendUnits(null, 0);
  const selectableUnits = availableUnits
    .filter(unit => !unit.isSiteLeadership && unit.assignedToMe)
    .map(unit => ({ ...unit, depth: Math.max(0, unit.depth - 1) }));
  const selectedUnit = availableUnits.find(unit => unit.id === selectedUnitId);
  const canManageScope = selectedUnitId ? Boolean(selectedUnit?.isLeader) : Boolean(site?.isTopLevelLeader);
  const taskLevelCount = (site?.hasTopLevelAccess ? 1 : 0) + selectableUnits.length;
  const siteLeadershipUnitId = availableUnits.find(unit => unit.isSiteLeadership)?.id ?? null;
  const directChildUnits = availableUnits.filter(unit => selectedUnitId
    ? unit.parentId === selectedUnitId
    : !unit.isSiteLeadership && (unit.parentId === null || unit.parentId === siteLeadershipUnitId));
  return { availableUnits, selectableUnits, selectedUnit, canManageScope, taskLevelCount, siteLeadershipUnitId, directChildUnits };
}
