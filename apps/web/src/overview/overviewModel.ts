import type { WorkItem } from "../work/WorkItemModels";
import type { TaskSite, TaskUnit } from "../work/WorkContextModels";
import type { AppPage } from "../navigation/permalinks";
import type { MessageKey } from "../localization";

const terminalStatuses = ["completed", "rejected", "cancelled", "reassigned"];
const actionStatuses = ["registered", "assigned", "under_review", "planning_approval", "planning_approved", "in_review"];

export const overviewStatusLabelKeys: Record<string, MessageKey> = {
  registered: "overviewStatusRegistered", under_review: "overviewStatusUnderReview", on_hold: "overviewStatusOnHold",
  planning: "overviewStatusPlanning", planning_approval: "overviewStatusPlanningApproval", planning_approved: "overviewStatusPlanningApproved", execution: "overviewStatusExecution",
  assigned: "overviewStatusAssigned", in_progress: "overviewStatusInProgress", in_review: "overviewStatusInReview", completed: "overviewStatusCompleted",
  rejected: "overviewStatusRejected", cancelled: "overviewStatusCancelled", request_cancelled: "overviewStatusRequestCancelled",
};

export function isReceivedRequest(item: WorkItem) {
  return !item.isOutgoingRequest && Boolean(item.senderSiteName);
}

export function overviewWorkspaceFor(item: WorkItem): AppPage {
  if (item.status === "planning") return "Planning";
  if (item.status === "planning_approval" || item.status === "planning_approved") return "Tasks";
  if (item.status === "execution") return "Execution";
  return "Tasks";
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
