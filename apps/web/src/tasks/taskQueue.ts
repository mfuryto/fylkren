import type { WorkItem } from "../work/WorkItemModels";

export function selectScopedItems(items: WorkItem[], selectedUnitId: string) {
  return selectedUnitId
    ? items.filter(item => item.assignedUnitId === selectedUnitId && !(
        (item.isOutgoingRequest && item.parentTitle) ||
        (item.parentWorkItemId && items.some(parent => parent.id === item.parentWorkItemId && parent.assignedUnitId === selectedUnitId))
      ))
    : items.filter(item => !item.parentWorkItemId && !(item.isOutgoingRequest && item.parentTitle));
}
