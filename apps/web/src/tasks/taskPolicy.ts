import type { WorkItem } from "../work/WorkItemModels";
import { translateActive, type MessageKey } from "../localization";

const taskStatusKeys: Record<string, MessageKey> = {
  registered: "taskStatusRegistered", under_review: "taskStatusUnderReview", on_hold: "taskStatusOnHold",
  rejected: "taskStatusRejected", planning: "taskStatusPlanning", planning_approval: "taskStatusPlanningApproval", planning_approved: "taskStatusPlanningApproved",
  execution: "taskStatusExecution", assigned: "taskStatusAssigned", in_progress: "taskStatusInProgress", in_review: "taskStatusInReview",
  completed: "taskStatusCompleted", cancelled: "taskStatusCancelled", request_cancelled: "taskStatusRequestCancelled", reassigned: "taskStatusReassigned",
};

const priorityKeys: Record<string, MessageKey> = { low: "priorityLow", normal: "priorityNormal", high: "priorityHigh", critical: "priorityCritical" };
export const taskStatusLabel = (status: string) => taskStatusKeys[status] ? translateActive(taskStatusKeys[status]) : status;
export const priorityLabel = (priority: string) => priorityKeys[priority] ? translateActive(priorityKeys[priority]) : priority;
export const unassignedStatuses = ["registered", "under_review", "on_hold", "planning", "planning_approved", "execution"];
export const terminalChildStatuses = ["completed", "reassigned", "cancelled", "rejected"];
export type TaskNextAction = { status: string; label: string };

export function canSendSideRequestAtStatus(status: string) {
  return !["registered", "on_hold", "planning", "planning_approval", "planning_approved", "execution", "in_review", "completed", "rejected", "cancelled", "reassigned", "request_cancelled"].includes(status);
}

const requestProgressKeys: Record<string, MessageKey> = {
  registered: "requestProgressReceived", under_review: "requestProgressUnderReview", on_hold: "requestProgressUnderReview", rejected: "requestProgressClosed",
  planning: "requestProgressProcessing", planning_approval: "requestProgressProcessing", planning_approved: "requestProgressProcessing", execution: "requestProgressProcessing",
  assigned: "requestProgressAssigned", in_progress: "requestProgressProcessing", in_review: "requestProgressProcessing",
  completed: "requestProgressAnswered", cancelled: "requestProgressClosed", reassigned: "requestProgressProcessing",
};
export const requestProgressLabel = (status: string) => requestProgressKeys[status] ? translateActive(requestProgressKeys[status]) : translateActive("requestProgressSent");

export function effectiveTaskStatus(item: WorkItem) {
  if (!item.isOutgoingRequest) return item.status;
  if (["completed", "cancelled"].includes(item.status)) return item.status;
  return ["completed", "rejected", "cancelled"].includes(item.requestProgressStatus ?? "") ? "in_review" : "in_progress";
}

export function isReceivedRequest(item: WorkItem) {
  return !item.isOutgoingRequest && item.workItemTypeName === "Anmodning" && Boolean(item.senderSiteName);
}

export function hasActiveDirectChildren(item: WorkItem, items: WorkItem[]) {
  return items.some(candidate => candidate.parentWorkItemId === item.id && !terminalChildStatuses.includes(candidate.status));
}

export function getTaskNextActions(item: WorkItem, items: WorkItem[], permissions: { isLeader: boolean; isOperational: boolean; canManage: boolean }) {
  const actions: TaskNextAction[] = [];
  if (item.isBlocked) return permissions.canManage && ["planning_approved", "in_progress"].includes(item.status) ? [{ status: "on_hold", label: translateActive("actionHold") }] : actions;
  if (item.isOutgoingRequest && permissions.isLeader && !["completed", "cancelled"].includes(item.status) && item.requestProgressStatus && ["completed", "rejected", "cancelled"].includes(item.requestProgressStatus))
    return [{ status: "completed", label: translateActive("actionCompleteRequest") }];
  if (!permissions.isOperational) return actions;
  if (item.status === "registered" && permissions.canManage)
    actions.push({ status: "under_review", label: translateActive("actionTakeUnderReview") });
  if (item.status === "assigned" && permissions.canManage && !hasActiveDirectChildren(item, items))
    actions.push({ status: "planning", label: translateActive("actionSendToPlanning") }, { status: "execution", label: translateActive("actionSendToExecution") });
  if (item.status === "planning_approved" && permissions.canManage)
    actions.push({ status: "on_hold", label: translateActive("actionHold") }, { status: "release", label: translateActive("actionStart") });
  const directChildren = items.filter(candidate => candidate.parentWorkItemId === item.id);
  if (item.status === "in_progress" && permissions.canManage) {
    actions.push({ status: "on_hold", label: translateActive("actionHold") });
    if (directChildren.length > 0 && directChildren.every(child => ["completed", "reassigned"].includes(child.status)))
      actions.push({ status: "in_review", label: translateActive("actionSendForReview") });
    else if (directChildren.length === 0 && !item.executionStatus)
      actions.push({ status: "execution", label: translateActive("actionSendToExecution") });
  }
  if (item.status === "in_review" && permissions.canManage)
    actions.push(item.finalReportApprovedAt ? { status: "completed", label: translateActive("actionComplete") } : { status: "in_progress", label: translateActive("actionReturn") });
  if (item.status === "rejected" && permissions.canManage)
    actions.push({ status: "under_review", label: translateActive("actionReopenReview") });
  if (item.status === "request_cancelled" && permissions.canManage)
    actions.push({ status: "completed", label: translateActive("actionAcknowledgeComplete") });
  return actions;
}

export function rootWorkTitle(item: WorkItem, items: WorkItem[]) {
  const itemMap = new Map(items.map(value => [value.id, value]));
  const visited = new Set<string>();
  let current = item;
  while (current.parentWorkItemId && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = itemMap.get(current.parentWorkItemId);
    if (!parent) break;
    current = parent;
  }
  return current.title;
}

export function workflowProgress(item: WorkItem) {
  if (item.executionStatus === "claimed") return translateActive("executionClaimedNoWorkflow");
  if (item.executionStatus === "available") return translateActive("executionAvailable");
  if (item.executionStatus === "submitted") return translateActive("executionSubmitted");
  const stepName = item.executionStepName ? translateActive("executionStepNameSuffix", { name: item.executionStepName }) : "";
  if (item.executionStatus) return translateActive("executionProgress", {
    workflow: item.executionWorkflowName ? translateActive("workflowNameSuffix", { name: item.executionWorkflowName }) : "",
    step: item.executionStepCount > 0 && item.executionCurrentStep !== null ? translateActive("executionStepSuffix", { current: Math.min(item.executionCurrentStep + 1, item.executionStepCount), total: item.executionStepCount, name: stepName }) : "",
    responses: item.awaitingExternalResponses ? translateActive("externalResponsesSuffix", { count: item.awaitingExternalResponses }) : "",
  });
  return item.workflowStepCount > 0 && item.workflowCurrentStep !== null
    ? translateActive("planningStepProgress", { current: Math.min(item.workflowCurrentStep + 1, item.workflowStepCount), total: item.workflowStepCount, name: item.workflowStepName ? translateActive("executionStepNameSuffix", { name: item.workflowStepName }) : "" })
    : null;
}
