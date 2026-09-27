import type { WorkItem } from "../work/WorkItemModels";
import type { TaskUnit } from "../work/WorkContextModels";

export function buildWorkContextTree(selectedItem: WorkItem, items: WorkItem[]) {
  const byId = new Map(items.map(item => [item.id, item]));
  let root = selectedItem;
  const ancestors = new Set<string>();
  while (root.parentWorkItemId && byId.has(root.parentWorkItemId) && !ancestors.has(root.id)) {
    ancestors.add(root.id);
    root = byId.get(root.parentWorkItemId)!;
  }

  const result: Array<{ item: WorkItem; depth: number }> = [];
  const appended = new Set<string>();
  const append = (item: WorkItem, depth: number) => {
    if (appended.has(item.id)) return;
    appended.add(item.id);
    result.push({ item, depth });
    items
      .filter(candidate => candidate.parentWorkItemId === item.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      .forEach(child => append(child, depth + 1));
  };
  append(root, 0);
  return result;
}

export function buildReportUnitPath(taskUnits: TaskUnit[], siteId: string, unitId: string | null) {
  const unitMap = new Map(taskUnits.filter(unit => unit.siteId === siteId).map(unit => [unit.id, unit]));
  const path: string[] = [];
  const visited = new Set<string>();
  let current = unitId;
  while (current && !visited.has(current)) {
    visited.add(current);
    const unit = unitMap.get(current);
    if (!unit) break;
    if (!unit.isSiteLeadership) path.push(unit.name);
    current = unit.parentId;
  }
  return path.reverse();
}
