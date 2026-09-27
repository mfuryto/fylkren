import type { WorkItem } from "../work/WorkItemModels";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";

const terminalStatuses = ["completed", "rejected", "cancelled", "reassigned"];
const actionStatuses = ["registered", "assigned", "under_review", "planning_approval", "planning_approved", "in_review"];

export const overviewStatusLabels: Record<string, string> = {
  registered: "Registrert", under_review: "Til vurdering", on_hold: "Avventer",
  planning: "Planlegging", planning_approval: "Plan til godkjenning", planning_approved: "Plan godkjent · avventer iverksetting", execution: "Utførelse",
  assigned: "Fordelt", in_progress: "Pågår", in_review: "Til kontroll", completed: "Fullført",
  rejected: "Avvist", cancelled: "Kansellert", request_cancelled: "Trukket av avsender",
};

export function isReceivedRequest(item: WorkItem) {
  return !item.isOutgoingRequest && item.workItemTypeName === "Anmodning" && Boolean(item.senderSiteName);
}

export function overviewWorkspaceFor(item: WorkItem) {
  if (item.status === "planning") return "Planlegging";
  if (item.status === "planning_approval" || item.status === "planning_approved") return "Oppgaver";
  if (item.status === "execution") return "Utførelse";
  return "Oppgaver";
}

export function canLoadDescendantWorkload(site: TaskSite | undefined, units: TaskUnit[], selectedUnitId: string) {
  if (!site) return false;
  if (!selectedUnitId) return site.hasTopLevelAccess;
  return Boolean(units.find(unit => unit.id === selectedUnitId && unit.siteId === site.siteId)?.isLeader);
}

export function buildOverviewMetrics(items: WorkItem[], selectedUnitId: string, now = Date.now()) {
  const isActiveItem = (item: WorkItem) => !terminalStatuses.includes(item.status);
  const scopedItems = selectedUnitId
    ? items.filter(item => item.assignedUnitId === selectedUnitId && !(
      (item.isOutgoingRequest && item.parentTitle) ||
      (item.parentWorkItemId && items.some(parent => parent.id === item.parentWorkItemId && parent.assignedUnitId === selectedUnitId))
    ))
    : items.filter(item => !item.parentWorkItemId && !(item.isOutgoingRequest && item.parentTitle));
  const statisticsScope = Array.from(new Map([...scopedItems, ...items.filter(item =>
    item.isOutgoingRequest && (!selectedUnitId || item.assignedUnitId === selectedUnitId))]
    .map(item => [item.id, item])).values());
  const activeLeafItems = items.filter(item => isActiveItem(item) && !items.some(child =>
    child.parentWorkItemId === item.id && isActiveItem(child) && !child.isOutgoingRequest));
  const workloadItems = selectedUnitId ? activeLeafItems.filter(item => item.assignedUnitId === selectedUnitId) : activeLeafItems;
  const sentRequests = items.filter(item => item.isOutgoingRequest && (!selectedUnitId || item.assignedUnitId === selectedUnitId) && !["completed", "cancelled"].includes(item.status));
  const active = workloadItems.filter(item => !item.isOutgoingRequest && !terminalStatuses.includes(item.status));
  const deadlineItems = workloadItems.filter(item => item.isOutgoingRequest
    ? !["completed", "cancelled"].includes(item.status) && !["completed", "rejected", "cancelled"].includes(item.requestProgressStatus ?? "")
    : !terminalStatuses.includes(item.status));
  const nearDeadline = deadlineItems.filter(item => item.dueAt && new Date(item.dueAt).getTime() >= now && new Date(item.dueAt).getTime() <= now + 7 * 24 * 60 * 60 * 1000);
  const overdue = deadlineItems.filter(item => item.dueAt && new Date(item.dueAt).getTime() < now);
  const hasReturnedChild = (item: WorkItem) => {
    const children = items.filter(candidate => candidate.parentWorkItemId === item.id);
    return !terminalStatuses.includes(item.status) && children.some(child => child.status === "completed") && children.every(child => terminalStatuses.includes(child.status));
  };
  const scopedIds = new Set(scopedItems.map(item => item.id));
  const ordinaryNeedsAction = active.filter(item => scopedIds.has(item.id) &&
    !item.isCrossSiteView && !isReceivedRequest(item) &&
    (actionStatuses.includes(item.status) || hasReturnedChild(item) || item.priority === "critical" || Boolean(item.dueAt && new Date(item.dueAt).getTime() < now)),
  );
  const requestNeedsAction = [...scopedItems, ...sentRequests].filter(item => !item.isCrossSiteView && (item.isOutgoingRequest
    ? !["completed", "cancelled"].includes(item.status) && ["completed", "rejected", "cancelled"].includes(item.requestProgressStatus ?? "")
    : isReceivedRequest(item) && (["registered", "under_review", "planning_approval", "planning_approved", "in_review", "request_cancelled"].includes(item.status) || hasReturnedChild(item))));
  const needsAction = Array.from(new Map([...ordinaryNeedsAction, ...requestNeedsAction].map(item => [item.id, item])).values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return { scopedItems, statisticsScope, activeLeafItems, sentRequests, active, nearDeadline, overdue, needsAction };
}
